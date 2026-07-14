import { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../db.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const JWT_SECRET = process.env.JWT_SECRET || 'ksb_poss_secret_key_12345';

// Auto-block users after 30 days from registration
const TRIAL_DAYS = 30;

function isExpired(createdAt: Date): boolean {
  const now = new Date();
  const diffMs = now.getTime() - new Date(createdAt).getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays > TRIAL_DAYS;
}

export async function login(req: AuthenticatedRequest, res: Response) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Foydalanuvchi nomi va parol kiritilishi shart' });
    }

    const user = await prisma.user.findUnique({
      where: { username },
      include: { shop: true }
    });

    if (!user) {
      return res.status(401).json({ error: 'Foydalanuvchi nomi yoki parol xato' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Foydalanuvchi nomi yoki parol xato' });
    }

    // Super Admin is never blocked
    if (user.role !== 'SUPER_ADMIN') {
      // Auto-block if trial expired and not already blocked
      if (!user.isBlocked && isExpired(user.createdAt)) {
        await prisma.user.update({ where: { id: user.id }, data: { isBlocked: true } });
        return res.status(403).json({ 
          error: 'Hisobingiz 30 kunlik sinov muddati tugaganligi sababli bloklandi. Super Admin bilan bog\'laning.' 
        });
      }
      if (user.isBlocked) {
        return res.status(403).json({ 
          error: 'Hisobingiz bloklangan. Super Admin bilan bog\'laning.' 
        });
      }
    }

    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        role: user.role, 
        fullName: user.fullName,
        shopId: user.shopId || ''
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.fullName,
        shopId: user.shopId,
        shopName: user.shop?.name || 'KSB Super Admin',
        pinCode: user.pinCode || '',
        shop: user.shop ? {
          name: user.shop.name,
          address: user.shop.address,
          phone: user.shop.phone,
          tgBotToken: user.shop.tgBotToken || '',
          tgChatId: user.shop.tgChatId || ''
        } : null
      }
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Tizim xatoligi yuz berdi' });
  }
}

export async function register(req: AuthenticatedRequest, res: Response) {
  try {
    const { username, password, role, fullName, shopName, address, phone } = req.body;

    if (!username || !password || !role || !fullName) {
      return res.status(400).json({ error: 'Barcha majburiy maydonlar to\'ldirilishi shart' });
    }

    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ error: 'Ushbu foydalanuvchi nomi band' });
    }

    const finalShopName = shopName || "KSB POSS DO'KONI";
    const finalAddress = address || "Toshkent sh., Chilonzor tumani";
    const finalPhone = phone || "+998 (99) 123-45-67";

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const result = await prisma.$transaction(async (tx) => {
      const shop = await tx.shop.create({
        data: {
          name: finalShopName,
          address: finalAddress,
          phone: finalPhone
        }
      });

      const user = await tx.user.create({
        data: {
          username,
          passwordHash,
          plainPassword: password,
          role,
          fullName,
          shopId: shop.id
        }
      });

      await tx.category.create({
        data: { name: 'Barchasi', shopId: shop.id }
      });

      return { shop, user };
    });

    res.status(201).json({
      message: 'Foydalanuvchi va do\'kon muvaffaqiyatli ro\'yxatdan o\'tdi',
      user: {
        id: result.user.id,
        username: result.user.username,
        role: result.user.role,
        fullName: result.user.fullName,
        shopId: result.user.shopId,
        shopName: result.shop.name
      }
    });
  } catch (error: any) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Foydalanuvchini ro\'yxatga olishda xatolik yuz berdi' });
  }
}

export async function changePassword(req: AuthenticatedRequest, res: Response) {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user?.id;

    if (!userId) return res.status(401).json({ error: 'Avtorizatsiyadan o\'tilmagan' });
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: 'Eski va yangi parollar kiritilishi shart' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });

    const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isMatch) return res.status(400).json({ error: 'Eski parol xato kiritilgan' });

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash, plainPassword: newPassword }
    });

    res.json({ message: 'Parol muvaffaqiyatli o\'zgartirildi' });
  } catch (error) {
    console.error('ChangePassword error:', error);
    res.status(500).json({ error: 'Parolni o\'zgartirishda xatolik yuz berdi' });
  }
}

// Super Admin: Get all registered shops and users
export async function getAllUsers(req: AuthenticatedRequest, res: Response) {
  try {
    if (req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Bu funksiya faqat Super Admin uchun' });
    }

    const users = await prisma.user.findMany({
      where: { role: { not: 'SUPER_ADMIN' } },
      include: { shop: true },
      orderBy: { createdAt: 'desc' }
    });

    const result = users.map(u => {
      const expired = isExpired(u.createdAt);
      return {
        id: u.id,
        fullName: u.fullName,
        username: u.username,
        plainPassword: u.plainPassword,
        pinCode: u.pinCode || '',
        role: u.role,
        isBlocked: u.isBlocked,
        isExpired: expired,
        shopName: u.shop?.name || '-',
        address: u.shop?.address || '-',
        phone: u.shop?.phone || '-',
        shopId: u.shopId,
        createdAt: u.createdAt
      };
    });

    res.json(result);
  } catch (error) {
    console.error('getAllUsers error:', error);
    res.status(500).json({ error: 'Foydalanuvchilar ro\'yxatini yuklashda xatolik' });
  }
}

// Super Admin: Toggle block/unblock user
export async function toggleBlockUser(req: AuthenticatedRequest, res: Response) {
  try {
    if (req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Bu funksiya faqat Super Admin uchun' });
    }
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });

    const updated = await prisma.user.update({
      where: { id },
      data: { isBlocked: !user.isBlocked }
    });

    res.json({ 
      message: updated.isBlocked ? 'Foydalanuvchi bloklandi' : 'Foydalanuvchi blokdan chiqarildi',
      isBlocked: updated.isBlocked 
    });
  } catch (error) {
    console.error('toggleBlock error:', error);
    res.status(500).json({ error: 'Amalni bajarishda xatolik' });
  }
}

// Super Admin: Delete user (with password verification)
export async function deleteUser(req: AuthenticatedRequest, res: Response) {
  try {
    if (req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Bu funksiya faqat Super Admin uchun' });
    }

    const { id } = req.params;
    const { superAdminPassword } = req.body;

    if (!superAdminPassword) {
      return res.status(400).json({ error: 'Super Admin paroli kiritilishi shart' });
    }

    // Verify super admin password
    const superAdmin = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!superAdmin) return res.status(401).json({ error: 'Super Admin topilmadi' });

    const isMatch = await bcrypt.compare(superAdminPassword, superAdmin.passwordHash);
    if (!isMatch) return res.status(401).json({ error: 'Super Admin paroli xato' });

    const targetUser = await prisma.user.findUnique({ where: { id }, include: { shop: true } });
    if (!targetUser) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });

    // Delete user's shop (cascade deletes products, sales, etc.)
    if (targetUser.shopId) {
      await prisma.shop.delete({ where: { id: targetUser.shopId } });
    } else {
      await prisma.user.delete({ where: { id } });
    }

    res.json({ message: 'Foydalanuvchi va barcha ma\'lumotlari o\'chirildi' });
  } catch (error) {
    console.error('deleteUser error:', error);
    res.status(500).json({ error: 'Foydalanuvchini o\'chirishda xatolik' });
  }
}

export async function getShopSettings(req: AuthenticatedRequest, res: Response) {
  try {
    const shopId = req.user?.shopId;
    if (!shopId) {
      return res.status(401).json({ error: 'Avtorizatsiyadan o\'tilmagan' });
    }

    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) {
      return res.status(404).json({ error: 'Do\'kon topilmadi' });
    }

    res.json(shop);
  } catch (error) {
    console.error('getShopSettings error:', error);
    res.status(500).json({ error: 'Sozlamalarni yuklashda xatolik' });
  }
}

export async function updateShopSettings(req: AuthenticatedRequest, res: Response) {
  try {
    const shopId = req.user?.shopId;
    if (!shopId) {
      return res.status(401).json({ error: 'Avtorizatsiyadan o\'tilmagan' });
    }

    const { shopName, address, phone, tgBotToken, tgChatId } = req.body;

    const updated = await prisma.shop.update({
      where: { id: shopId },
      data: {
        name: shopName,
        address,
        phone,
        tgBotToken: tgBotToken || "",
        tgChatId: tgChatId || ""
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('updateShopSettings error:', error);
    res.status(500).json({ error: 'Sozlamalarni saqlashda xatolik' });
  }
}

export async function updatePinCode(req: AuthenticatedRequest, res: Response) {
  try {
    const { pinCode } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Avtorizatsiyadan o\'tilmagan' });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { pinCode: pinCode || "" }
    });

    res.json({ message: 'PIN kod muvaffaqiyatli saqlandi' });
  } catch (error) {
    console.error('updatePinCode error:', error);
    res.status(500).json({ error: 'PIN kodni saqlashda xatolik yuz berdi' });
  }
}

export async function updateUserAdmin(req: AuthenticatedRequest, res: Response) {
  try {
    if (req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Bu funksiya faqat Super Admin uchun' });
    }
    const { id } = req.params;
    const { fullName, username, password, pinCode } = req.body;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });

    const updateData: any = {};
    if (fullName) updateData.fullName = fullName.trim();
    if (username) {
      const existing = await prisma.user.findUnique({ where: { username: username.trim() } });
      if (existing && existing.id !== id) {
        return res.status(400).json({ error: 'Ushbu foydalanuvchi nomi band' });
      }
      updateData.username = username.trim();
    }
    if (password && password.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      updateData.passwordHash = await bcrypt.hash(password, salt);
      updateData.plainPassword = password;
    }
    if (pinCode !== undefined) {
      updateData.pinCode = pinCode.trim();
    }

    await prisma.user.update({
      where: { id },
      data: updateData
    });

    res.json({ message: 'Foydalanuvchi ma\'lumotlari yangilandi' });
  } catch (error) {
    console.error('updateUserAdmin error:', error);
    res.status(500).json({ error: 'Foydalanuvchi ma\'lumotlarini yangilashda xatolik yuz berdi' });
  }
}

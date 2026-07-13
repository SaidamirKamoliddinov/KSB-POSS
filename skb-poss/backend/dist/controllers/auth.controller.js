"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
exports.register = register;
exports.changePassword = changePassword;
exports.getAllUsers = getAllUsers;
exports.toggleBlockUser = toggleBlockUser;
exports.deleteUser = deleteUser;
exports.getShopSettings = getShopSettings;
exports.updateShopSettings = updateShopSettings;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_js_1 = __importDefault(require("../db.js"));
const JWT_SECRET = process.env.JWT_SECRET || 'ksb_poss_secret_key_12345';
// Auto-block users after 30 days from registration
const TRIAL_DAYS = 30;
function isExpired(createdAt) {
    const now = new Date();
    const diffMs = now.getTime() - new Date(createdAt).getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays > TRIAL_DAYS;
}
async function login(req, res) {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Foydalanuvchi nomi va parol kiritilishi shart' });
        }
        const user = await db_js_1.default.user.findUnique({
            where: { username },
            include: { shop: true }
        });
        if (!user) {
            return res.status(401).json({ error: 'Foydalanuvchi nomi yoki parol xato' });
        }
        const isMatch = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Foydalanuvchi nomi yoki parol xato' });
        }
        // Super Admin is never blocked
        if (user.role !== 'SUPER_ADMIN') {
            // Auto-block if trial expired and not already blocked
            if (!user.isBlocked && isExpired(user.createdAt)) {
                await db_js_1.default.user.update({ where: { id: user.id }, data: { isBlocked: true } });
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
        const token = jsonwebtoken_1.default.sign({
            id: user.id,
            username: user.username,
            role: user.role,
            fullName: user.fullName,
            shopId: user.shopId || ''
        }, JWT_SECRET, { expiresIn: '30d' });
        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                fullName: user.fullName,
                shopId: user.shopId,
                shopName: user.shop?.name || 'KSB Super Admin',
                shop: user.shop ? {
                    name: user.shop.name,
                    address: user.shop.address,
                    phone: user.shop.phone,
                    tgBotToken: user.shop.tgBotToken || '',
                    tgChatId: user.shop.tgChatId || ''
                } : null
            }
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Tizim xatoligi yuz berdi' });
    }
}
async function register(req, res) {
    try {
        const { username, password, role, fullName, shopName, address, phone } = req.body;
        if (!username || !password || !role || !fullName) {
            return res.status(400).json({ error: 'Barcha majburiy maydonlar to\'ldirilishi shart' });
        }
        const existingUser = await db_js_1.default.user.findUnique({ where: { username } });
        if (existingUser) {
            return res.status(400).json({ error: 'Ushbu foydalanuvchi nomi band' });
        }
        const finalShopName = shopName || "KSB POSS DO'KONI";
        const finalAddress = address || "Toshkent sh., Chilonzor tumani";
        const finalPhone = phone || "+998 (99) 123-45-67";
        const salt = await bcryptjs_1.default.genSalt(10);
        const passwordHash = await bcryptjs_1.default.hash(password, salt);
        const result = await db_js_1.default.$transaction(async (tx) => {
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
    }
    catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Foydalanuvchini ro\'yxatga olishda xatolik yuz berdi' });
    }
}
async function changePassword(req, res) {
    try {
        const { oldPassword, newPassword } = req.body;
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ error: 'Avtorizatsiyadan o\'tilmagan' });
        if (!oldPassword || !newPassword) {
            return res.status(400).json({ error: 'Eski va yangi parollar kiritilishi shart' });
        }
        const user = await db_js_1.default.user.findUnique({ where: { id: userId } });
        if (!user)
            return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
        const isMatch = await bcryptjs_1.default.compare(oldPassword, user.passwordHash);
        if (!isMatch)
            return res.status(400).json({ error: 'Eski parol xato kiritilgan' });
        const salt = await bcryptjs_1.default.genSalt(10);
        const newHash = await bcryptjs_1.default.hash(newPassword, salt);
        await db_js_1.default.user.update({
            where: { id: userId },
            data: { passwordHash: newHash, plainPassword: newPassword }
        });
        res.json({ message: 'Parol muvaffaqiyatli o\'zgartirildi' });
    }
    catch (error) {
        console.error('ChangePassword error:', error);
        res.status(500).json({ error: 'Parolni o\'zgartirishda xatolik yuz berdi' });
    }
}
// Super Admin: Get all registered shops and users
async function getAllUsers(req, res) {
    try {
        if (req.user?.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Bu funksiya faqat Super Admin uchun' });
        }
        const users = await db_js_1.default.user.findMany({
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
    }
    catch (error) {
        console.error('getAllUsers error:', error);
        res.status(500).json({ error: 'Foydalanuvchilar ro\'yxatini yuklashda xatolik' });
    }
}
// Super Admin: Toggle block/unblock user
async function toggleBlockUser(req, res) {
    try {
        if (req.user?.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Bu funksiya faqat Super Admin uchun' });
        }
        const { id } = req.params;
        const user = await db_js_1.default.user.findUnique({ where: { id } });
        if (!user)
            return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
        const updated = await db_js_1.default.user.update({
            where: { id },
            data: { isBlocked: !user.isBlocked }
        });
        res.json({
            message: updated.isBlocked ? 'Foydalanuvchi bloklandi' : 'Foydalanuvchi blokdan chiqarildi',
            isBlocked: updated.isBlocked
        });
    }
    catch (error) {
        console.error('toggleBlock error:', error);
        res.status(500).json({ error: 'Amalni bajarishda xatolik' });
    }
}
// Super Admin: Delete user (with password verification)
async function deleteUser(req, res) {
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
        const superAdmin = await db_js_1.default.user.findUnique({ where: { id: req.user.id } });
        if (!superAdmin)
            return res.status(401).json({ error: 'Super Admin topilmadi' });
        const isMatch = await bcryptjs_1.default.compare(superAdminPassword, superAdmin.passwordHash);
        if (!isMatch)
            return res.status(401).json({ error: 'Super Admin paroli xato' });
        const targetUser = await db_js_1.default.user.findUnique({ where: { id }, include: { shop: true } });
        if (!targetUser)
            return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
        // Delete user's shop (cascade deletes products, sales, etc.)
        if (targetUser.shopId) {
            await db_js_1.default.shop.delete({ where: { id: targetUser.shopId } });
        }
        else {
            await db_js_1.default.user.delete({ where: { id } });
        }
        res.json({ message: 'Foydalanuvchi va barcha ma\'lumotlari o\'chirildi' });
    }
    catch (error) {
        console.error('deleteUser error:', error);
        res.status(500).json({ error: 'Foydalanuvchini o\'chirishda xatolik' });
    }
}
async function getShopSettings(req, res) {
    try {
        const shopId = req.user?.shopId;
        if (!shopId) {
            return res.status(401).json({ error: 'Avtorizatsiyadan o\'tilmagan' });
        }
        const shop = await db_js_1.default.shop.findUnique({ where: { id: shopId } });
        if (!shop) {
            return res.status(404).json({ error: 'Do\'kon topilmadi' });
        }
        res.json(shop);
    }
    catch (error) {
        console.error('getShopSettings error:', error);
        res.status(500).json({ error: 'Sozlamalarni yuklashda xatolik' });
    }
}
async function updateShopSettings(req, res) {
    try {
        const shopId = req.user?.shopId;
        if (!shopId) {
            return res.status(401).json({ error: 'Avtorizatsiyadan o\'tilmagan' });
        }
        const { shopName, address, phone, tgBotToken, tgChatId } = req.body;
        const updated = await db_js_1.default.shop.update({
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
    }
    catch (error) {
        console.error('updateShopSettings error:', error);
        res.status(500).json({ error: 'Sozlamalarni saqlashda xatolik' });
    }
}

import { Response } from 'express';
import prisma from '../db.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export async function getCategories(req: AuthenticatedRequest, res: Response) {
  try {
    const shopId = req.user?.shopId;
    if (!shopId) {
      return res.status(401).json({ error: 'Avtorizatsiyadan o\'tilmagan' });
    }

    const categories = await prisma.category.findMany({
      where: { shopId },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { products: true }
        }
      }
    });
    res.json(categories);
  } catch (error) {
    console.error('getCategories error:', error);
    res.status(500).json({ error: 'Kategoriyalarni yuklashda xatolik' });
  }
}

export async function createCategory(req: AuthenticatedRequest, res: Response) {
  try {
    const { name } = req.body;
    const shopId = req.user?.shopId;

    if (!shopId) {
      return res.status(401).json({ error: 'Avtorizatsiyadan o\'tilmagan' });
    }

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Kategoriya nomi kiritilishi shart' });
    }

    const trimmedName = name.trim();

    // Check duplicate per shop
    const existing = await prisma.category.findFirst({
      where: { name: trimmedName, shopId }
    });

    if (existing) {
      return res.status(400).json({ error: 'Ushbu nomli kategoriya allaqachon mavjud' });
    }

    const category = await prisma.category.create({
      data: { name: trimmedName, shopId }
    });

    res.status(201).json(category);
  } catch (error) {
    console.error('createCategory error:', error);
    res.status(500).json({ error: 'Kategoriya yaratishda xatolik' });
  }
}

export async function updateCategory(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const shopId = req.user?.shopId;

    if (!shopId) {
      return res.status(401).json({ error: 'Avtorizatsiyadan o\'tilmagan' });
    }

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Kategoriya nomi kiritilishi shart' });
    }

    const trimmedName = name.trim();

    // Check ownership
    const categoryToUpdate = await prisma.category.findFirst({
      where: { id, shopId }
    });
    if (!categoryToUpdate) {
      return res.status(404).json({ error: 'Kategoriya topilmadi' });
    }

    // Check duplicate per shop
    const existing = await prisma.category.findFirst({
      where: { name: trimmedName, shopId }
    });

    if (existing && existing.id !== id) {
      return res.status(400).json({ error: 'Ushbu nomli kategoriya allaqachon mavjud' });
    }

    const category = await prisma.category.update({
      where: { id },
      data: { name: trimmedName }
    });

    res.json(category);
  } catch (error) {
    console.error('updateCategory error:', error);
    res.status(500).json({ error: 'Kategoriyani tahrirlashda xatolik' });
  }
}

export async function deleteCategory(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const shopId = req.user?.shopId;

    if (!shopId) {
      return res.status(401).json({ error: 'Avtorizatsiyadan o\'tilmagan' });
    }

    // Check ownership
    const categoryToDelete = await prisma.category.findFirst({
      where: { id, shopId }
    });
    if (!categoryToDelete) {
      return res.status(404).json({ error: 'Kategoriya topilmadi' });
    }

    // Check if category has products
    const productsCount = await prisma.product.count({
      where: { categoryId: id }
    });

    if (productsCount > 0) {
      return res.status(400).json({ error: 'Kategoriyada mahsulotlar borligi sababli uni o\'chirib bo\'lmaydi' });
    }

    await prisma.category.delete({
      where: { id }
    });

    res.json({ message: 'Kategoriya muvaffaqiyatli o\'chirildi' });
  } catch (error) {
    console.error('deleteCategory error:', error);
    res.status(500).json({ error: 'Kategoriyani o\'chirishda xatolik' });
  }
}

import { Response } from 'express';
import prisma from '../db.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export async function getProducts(req: AuthenticatedRequest, res: Response) {
  try {
    const { search } = req.query;
    const shopId = req.user?.shopId;

    if (!shopId) {
      return res.status(401).json({ error: 'Avtorizatsiyadan o\'tilmagan' });
    }

    const whereClause: any = { shopId };

    if (search && typeof search === 'string' && search !== '') {
      whereClause.OR = [
        { name: { contains: search } },
        { barcode: { contains: search } }
      ];
    }

    const products = await prisma.product.findMany({
      where: whereClause,
      include: {
        category: {
          select: { name: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    res.json(products);
  } catch (error) {
    console.error('getProducts error:', error);
    res.status(500).json({ error: 'Mahsulotlarni yuklashda xatolik yuz berdi' });
  }
}

export async function createProduct(req: AuthenticatedRequest, res: Response) {
  try {
    const { barcode, name, categoryId, costPrice, sellingPrice, stock, unit } = req.body;
    const shopId = req.user?.shopId;

    if (!shopId) {
      return res.status(401).json({ error: 'Avtorizatsiyadan o\'tilmagan' });
    }

    if (!name || costPrice === undefined || sellingPrice === undefined || stock === undefined || !unit) {
      return res.status(400).json({ error: 'Barcha majburiy maydonlar to\'ldirilishi shart' });
    }

    // Auto-resolve default Category ID if not sent by UI
    let finalCategoryId = categoryId;
    if (!finalCategoryId) {
      let defaultCat = await prisma.category.findFirst({
        where: { name: 'Barchasi', shopId }
      });
      if (!defaultCat) {
        defaultCat = await prisma.category.create({
          data: { name: 'Barchasi', shopId }
        });
      }
      finalCategoryId = defaultCat.id;
    }

    // Check barcode duplicate per shop
    if (barcode && barcode.trim() !== '') {
      const existing = await prisma.product.findFirst({
        where: { barcode: barcode.trim(), shopId }
      });
      if (existing) {
        return res.status(400).json({ error: 'Ushbu shtrix-kodga ega mahsulot do\'konda allaqachon mavjud' });
      }
    }

    const product = await prisma.product.create({
      data: {
        barcode: barcode && barcode.trim() !== '' ? barcode.trim() : null,
        name: name.trim(),
        categoryId: finalCategoryId,
        shopId,
        costPrice: parseFloat(costPrice),
        sellingPrice: parseFloat(sellingPrice),
        stock: parseFloat(stock),
        unit
      },
      include: {
        category: {
          select: { name: true }
        }
      }
    });

    res.status(201).json(product);
  } catch (error) {
    console.error('createProduct error:', error);
    res.status(500).json({ error: 'Mahsulot yaratishda xatolik yuz berdi' });
  }
}

export async function updateProduct(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { barcode, name, categoryId, costPrice, sellingPrice, stock, unit } = req.body;
    const shopId = req.user?.shopId;

    if (!shopId) {
      return res.status(401).json({ error: 'Avtorizatsiyadan o\'tilmagan' });
    }

    if (!name || costPrice === undefined || sellingPrice === undefined || stock === undefined || !unit) {
      return res.status(400).json({ error: 'Barcha majburiy maydonlar to\'ldirilishi shart' });
    }

    // Check ownership
    const productToUpdate = await prisma.product.findFirst({
      where: { id, shopId }
    });
    if (!productToUpdate) {
      return res.status(404).json({ error: 'Mahsulot topilmadi' });
    }

    // Auto-resolve default Category ID if not sent by UI
    let finalCategoryId = categoryId;
    if (!finalCategoryId) {
      let defaultCat = await prisma.category.findFirst({
        where: { name: 'Barchasi', shopId }
      });
      if (!defaultCat) {
        defaultCat = await prisma.category.create({
          data: { name: 'Barchasi', shopId }
        });
      }
      finalCategoryId = defaultCat.id;
    }

    // Check barcode duplicate per shop
    if (barcode && barcode.trim() !== '') {
      const existing = await prisma.product.findFirst({
        where: { barcode: barcode.trim(), shopId }
      });
      if (existing && existing.id !== id) {
        return res.status(400).json({ error: 'Ushbu shtrix-kodga ega mahsulot do\'konda allaqachon mavjud' });
      }
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
        barcode: barcode && barcode.trim() !== '' ? barcode.trim() : null,
        name: name.trim(),
        categoryId: finalCategoryId,
        costPrice: parseFloat(costPrice),
        sellingPrice: parseFloat(sellingPrice),
        stock: parseFloat(stock),
        unit
      },
      include: {
        category: {
          select: { name: true }
        }
      }
    });

    res.json(product);
  } catch (error) {
    console.error('updateProduct error:', error);
    res.status(500).json({ error: 'Mahsulotni tahrirlashda xatolik yuz berdi' });
  }
}

export async function deleteProduct(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const shopId = req.user?.shopId;

    if (!shopId) {
      return res.status(401).json({ error: 'Avtorizatsiyadan o\'tilmagan' });
    }

    // Check ownership
    const productToDelete = await prisma.product.findFirst({
      where: { id, shopId }
    });
    if (!productToDelete) {
      return res.status(404).json({ error: 'Mahsulot topilmadi' });
    }

    // Check if the product has ever been sold
    const saleItemsCount = await prisma.saleItem.count({
      where: { productId: id }
    });

    if (saleItemsCount > 0) {
      return res.status(400).json({ error: 'Ushbu mahsulot sotilganligi sababli uni o\'chirib bo\'lmaydi' });
    }

    await prisma.product.delete({
      where: { id }
    });

    res.json({ message: 'Mahsulot muvaffaqiyatli o\'chirildi' });
  } catch (error) {
    console.error('deleteProduct error:', error);
    res.status(500).json({ error: 'Mahsulotni o\'chirishda xatolik yuz berdi' });
  }
}

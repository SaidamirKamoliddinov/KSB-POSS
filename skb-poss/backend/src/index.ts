import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import prisma from './db.js';

import { login, register, changePassword, getAllUsers, toggleBlockUser, deleteUser } from './controllers/auth.controller.js';
import { getCategories, createCategory, updateCategory, deleteCategory } from './controllers/category.controller.js';
import { getProducts, createProduct, updateProduct, deleteProduct } from './controllers/product.controller.js';
import { createSale, getSales, getSaleById, deleteSale, payDebt, clearCustomerDebt } from './controllers/sale.controller.js';
import { getDashboardStats } from './controllers/report.controller.js';
import { authenticateJWT, authorizeRoles } from './middleware/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.json());

// ─── AUTH ROUTES ───────────────────────────────────────────────────────────────
app.post('/api/auth/login', login);
app.post('/api/auth/register', register);
app.post('/api/auth/change-password', authenticateJWT, changePassword);
app.get('/api/auth/all-users', authenticateJWT, getAllUsers); // Super Admin only
app.patch('/api/auth/users/:id/toggle-block', authenticateJWT, toggleBlockUser); // Super Admin only
app.delete('/api/auth/users/:id', authenticateJWT, deleteUser); // Super Admin only

// ─── CATEGORIES ────────────────────────────────────────────────────────────────
app.get('/api/categories', authenticateJWT, getCategories);
app.post('/api/categories', authenticateJWT, authorizeRoles('ADMIN'), createCategory);
app.put('/api/categories/:id', authenticateJWT, authorizeRoles('ADMIN'), updateCategory);
app.delete('/api/categories/:id', authenticateJWT, authorizeRoles('ADMIN'), deleteCategory);

// ─── PRODUCTS ──────────────────────────────────────────────────────────────────
app.get('/api/products', authenticateJWT, getProducts);
app.post('/api/products', authenticateJWT, authorizeRoles('ADMIN'), createProduct);
app.post('/api/products/bulk', authenticateJWT, authorizeRoles('ADMIN'), async (req, res) => {
  // Bulk product creation endpoint
  try {
    const { products } = req.body;
    const shopId = (req as any).user?.shopId;
    if (!shopId) return res.status(401).json({ error: 'Avtorizatsiyadan o\'tilmagan' });
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'Mahsulotlar ro\'yxati bo\'sh' });
    }

    let defaultCat = await prisma.category.findFirst({ where: { name: 'Barchasi', shopId } });
    if (!defaultCat) {
      defaultCat = await prisma.category.create({ data: { name: 'Barchasi', shopId } });
    }

    const created = [];
    const errors = [];

    for (const p of products) {
      if (!p.name || !p.sellingPrice) { errors.push(`"${p.name || '?'}" - nomi yoki sotuv narxi yetishmaydi`); continue; }
      try {
        const product = await prisma.product.create({
          data: {
            name: p.name.trim(),
            barcode: p.barcode && p.barcode.trim() !== '' ? p.barcode.trim() : null,
            categoryId: defaultCat.id,
            shopId,
            costPrice: parseFloat(p.costPrice) || 0,
            sellingPrice: parseFloat(p.sellingPrice),
            stock: parseFloat(p.stock) || 999999,
            unit: p.unit || 'dona'
          }
        });
        created.push(product);
      } catch (e: any) {
        errors.push(`"${p.name}" - ${e.message?.includes('Unique') ? 'Shtrix-kod takrorlanmoqda' : 'Xatolik'}`);
      }
    }

    res.json({ created: created.length, errors });
  } catch (err: any) {
    console.error('Bulk create error:', err);
    res.status(500).json({ error: 'Mahsulotlarni toplu qo\'shishda xatolik' });
  }
});
app.put('/api/products/:id', authenticateJWT, authorizeRoles('ADMIN'), updateProduct);
app.delete('/api/products/:id', authenticateJWT, authorizeRoles('ADMIN'), deleteProduct);

// ─── SALES ─────────────────────────────────────────────────────────────────────
app.post('/api/sales', authenticateJWT, createSale);
app.get('/api/sales', authenticateJWT, getSales);
app.get('/api/sales/:id', authenticateJWT, getSaleById);
app.delete('/api/sales/:id', authenticateJWT, authorizeRoles('ADMIN'), deleteSale);
app.patch('/api/sales/:id/pay-debt', authenticateJWT, payDebt);
app.post('/api/sales/clear-debt', authenticateJWT, clearCustomerDebt);

// ─── REPORTS ───────────────────────────────────────────────────────────────────
app.get('/api/reports/dashboard', authenticateJWT, authorizeRoles('ADMIN'), getDashboardStats);

// ─── HEALTH ────────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date() }));

// ─── SETUP & STATUS ────────────────────────────────────────────────────────────
app.get('/api/db-status', async (_req, res) => {
  try {
    const userCount = await prisma.user.count();
    res.json({ status: "connected", userCount });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

app.post('/api/setup', async (_req, res) => {
  try {
    await seedInitialData();
    res.json({ status: "success", message: "Setup endpoint orqali ma'lumotlar muvaffaqiyatli seed qilindi!" });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// ─── SEED ──────────────────────────────────────────────────────────────────────
async function seedInitialData() {
  try {
    // 1. Seed Super Admin (no shop)
    const superAdminExists = await prisma.user.findUnique({ where: { username: 'superadmin' } });
    if (!superAdminExists) {
      const hash = await bcrypt.hash('super@2026', 10);
      await prisma.user.create({
        data: {
          username: 'superadmin',
          passwordHash: hash,
          plainPassword: 'super@2026',
          role: 'SUPER_ADMIN',
          fullName: 'KSB Super Administrator',
          shopId: null
        }
      });
      console.log('Super Admin yaratildi: superadmin / super@2026');
    }

    // 2. Seed demo shop if no regular users exist
    const userCount = await prisma.user.count({ where: { role: { not: 'SUPER_ADMIN' } } });
    if (userCount === 0) {
      const shop = await prisma.shop.create({
        data: {
          name: "KSB POSS DO'KONI",
          address: "Toshkent sh., Chilonzor tumani",
          phone: "+998 (99) 123-45-67"
        }
      });

      const adminHash = await bcrypt.hash('admin123', 10);
      await prisma.user.create({
        data: {
          username: 'admin',
          passwordHash: adminHash,
          plainPassword: 'admin123',
          role: 'ADMIN',
          fullName: 'Bosh Administrator',
          shopId: shop.id
        }
      });

      const cashierHash = await bcrypt.hash('kassir123', 10);
      await prisma.user.create({
        data: {
          username: 'kassir',
          passwordHash: cashierHash,
          plainPassword: 'kassir123',
          role: 'CASHIER',
          fullName: 'Kassir Gulnoza',
          shopId: shop.id
        }
      });

      const defaultCat = await prisma.category.create({
        data: { name: 'Barchasi', shopId: shop.id }
      });

      await prisma.product.createMany({
        data: [
          { name: 'Buxanka non', barcode: '40001', categoryId: defaultCat.id, shopId: shop.id, costPrice: 2000, sellingPrice: 3000, stock: 100, unit: 'dona' },
          { name: 'Coca-Cola 1.5L', barcode: '5449000000996', categoryId: defaultCat.id, shopId: shop.id, costPrice: 9500, sellingPrice: 12500, stock: 80, unit: 'dona' },
          { name: 'Pepsi 1.5L', barcode: '4780068001016', categoryId: defaultCat.id, shopId: shop.id, costPrice: 9200, sellingPrice: 12000, stock: 60, unit: 'dona' }
        ]
      });

      console.log('Demo do\'kon yaratildi: admin/admin123, kassir/kassir123');
    }
  } catch (err) {
    console.error('Seed error:', err);
    throw err;
  }
}

// Bind to 0.0.0.0 for Wi-Fi sync across devices
app.listen(Number(PORT), '0.0.0.0', async () => {
  console.log(`Backend server running on http://0.0.0.0:${PORT}`);
  await seedInitialData();
});

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const db_js_1 = __importDefault(require("./db.js"));
const auth_controller_js_1 = require("./controllers/auth.controller.js");
const category_controller_js_1 = require("./controllers/category.controller.js");
const product_controller_js_1 = require("./controllers/product.controller.js");
const sale_controller_js_1 = require("./controllers/sale.controller.js");
const report_controller_js_1 = require("./controllers/report.controller.js");
const auth_js_1 = require("./middleware/auth.js");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
}));
app.use(express_1.default.json());
// ─── AUTH ROUTES ───────────────────────────────────────────────────────────────
app.post('/api/auth/login', auth_controller_js_1.login);
app.post('/api/auth/register', auth_controller_js_1.register);
app.post('/api/auth/change-password', auth_js_1.authenticateJWT, auth_controller_js_1.changePassword);
app.put('/api/auth/update-pin', auth_js_1.authenticateJWT, auth_controller_js_1.updatePinCode);
app.get('/api/auth/all-users', auth_js_1.authenticateJWT, auth_controller_js_1.getAllUsers);
app.patch('/api/auth/users/:id/toggle-block', auth_js_1.authenticateJWT, auth_controller_js_1.toggleBlockUser);
app.put('/api/auth/users/:id', auth_js_1.authenticateJWT, auth_controller_js_1.updateUserAdmin);
app.delete('/api/auth/users/:id', auth_js_1.authenticateJWT, auth_controller_js_1.deleteUser);
// ─── CATEGORIES ────────────────────────────────────────────────────────────────
app.get('/api/categories', auth_js_1.authenticateJWT, category_controller_js_1.getCategories);
app.post('/api/categories', auth_js_1.authenticateJWT, (0, auth_js_1.authorizeRoles)('ADMIN'), category_controller_js_1.createCategory);
app.put('/api/categories/:id', auth_js_1.authenticateJWT, (0, auth_js_1.authorizeRoles)('ADMIN'), category_controller_js_1.updateCategory);
app.delete('/api/categories/:id', auth_js_1.authenticateJWT, (0, auth_js_1.authorizeRoles)('ADMIN'), category_controller_js_1.deleteCategory);
// ─── PRODUCTS ──────────────────────────────────────────────────────────────────
app.get('/api/products', auth_js_1.authenticateJWT, product_controller_js_1.getProducts);
app.get('/api/products/global-barcodes', auth_js_1.authenticateJWT, product_controller_js_1.getGlobalBarcodes);
app.get('/api/products/lookup-barcode/:barcode', auth_js_1.authenticateJWT, product_controller_js_1.lookupBarcode);
app.post('/api/products', auth_js_1.authenticateJWT, (0, auth_js_1.authorizeRoles)('ADMIN'), product_controller_js_1.createProduct);
app.post('/api/products/bulk', auth_js_1.authenticateJWT, (0, auth_js_1.authorizeRoles)('ADMIN'), async (req, res) => {
    try {
        const { products } = req.body;
        const shopId = req.user?.shopId;
        if (!shopId)
            return res.status(401).json({ error: 'Avtorizatsiyadan o\'tilmagan' });
        if (!Array.isArray(products) || products.length === 0) {
            return res.status(400).json({ error: 'Mahsulotlar ro\'yxati bo\'sh' });
        }
        let defaultCat = await db_js_1.default.category.findFirst({ where: { name: 'Barchasi', shopId } });
        if (!defaultCat) {
            defaultCat = await db_js_1.default.category.create({ data: { name: 'Barchasi', shopId } });
        }
        const created = [];
        const errors = [];
        for (const p of products) {
            if (!p.name || !p.sellingPrice) {
                errors.push(`"${p.name || '?'}" - nomi yoki sotuv narxi yetishmaydi`);
                continue;
            }
            try {
                const product = await db_js_1.default.product.create({
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
            }
            catch (e) {
                errors.push(`"${p.name}" - ${e.message?.includes('Unique') ? 'Shtrix-kod takrorlanmoqda' : 'Xatolik'}`);
            }
        }
        res.json({ created: created.length, errors });
    }
    catch (err) {
        console.error('Bulk create error:', err);
        res.status(500).json({ error: 'Mahsulotlarni toplu qo\'shishda xatolik' });
    }
});
app.put('/api/products/:id', auth_js_1.authenticateJWT, (0, auth_js_1.authorizeRoles)('ADMIN'), product_controller_js_1.updateProduct);
app.delete('/api/products/:id', auth_js_1.authenticateJWT, (0, auth_js_1.authorizeRoles)('ADMIN'), product_controller_js_1.deleteProduct);
// ─── SALES ─────────────────────────────────────────────────────────────────────
app.post('/api/sales', auth_js_1.authenticateJWT, sale_controller_js_1.createSale);
app.get('/api/sales', auth_js_1.authenticateJWT, sale_controller_js_1.getSales);
app.get('/api/sales/archive', auth_js_1.authenticateJWT, sale_controller_js_1.getSalesArchive);
app.post('/api/sales/archive/clear', auth_js_1.authenticateJWT, sale_controller_js_1.clearSalesArchive);
app.get('/api/sales/:id', auth_js_1.authenticateJWT, sale_controller_js_1.getSaleById);
app.delete('/api/sales/:id', auth_js_1.authenticateJWT, (0, auth_js_1.authorizeRoles)('ADMIN'), sale_controller_js_1.deleteSale);
app.patch('/api/sales/:id/pay-debt', auth_js_1.authenticateJWT, sale_controller_js_1.payDebt);
app.post('/api/sales/clear-debt', auth_js_1.authenticateJWT, sale_controller_js_1.clearCustomerDebt);
// ─── SHOP SETTINGS ─────────────────────────────────────────────────────────────
app.get('/api/shop', auth_js_1.authenticateJWT, auth_controller_js_1.getShopSettings);
app.put('/api/shop', auth_js_1.authenticateJWT, auth_controller_js_1.updateShopSettings);
// ─── REPORTS ───────────────────────────────────────────────────────────────────
app.get('/api/reports/dashboard', auth_js_1.authenticateJWT, (0, auth_js_1.authorizeRoles)('ADMIN'), report_controller_js_1.getDashboardStats);
app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date() }));
app.get('/api/test-soliq/:barcode', async (req, res) => {
    const results = {};
    const { barcode } = req.params;
    // 1. Test Soliq Tasnif
    try {
        const soliqResponse = await fetch(`https://tasnif.soliq.uz/api/cls-api/elasticsearch/search?search=${barcode}&size=10&page=0&lang=uz`);
        const text = await soliqResponse.text();
        results.soliq = { status: soliqResponse.status, length: text.length };
    }
    catch (err) {
        results.soliq = { error: err.message };
    }
    // 2. Test Open Food Facts
    try {
        const offResponse = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=product_name`);
        const text = await offResponse.text();
        results.openFoodFacts = { status: offResponse.status, length: text.length };
    }
    catch (err) {
        results.openFoodFacts = { error: err.message };
    }
    // 3. Test UPCitemdb
    try {
        const upcResponse = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`);
        const text = await upcResponse.text();
        results.upc = { status: upcResponse.status, length: text.length };
    }
    catch (err) {
        results.upc = { error: err.message };
    }
    res.json(results);
});
// ─── SETUP & STATUS ────────────────────────────────────────────────────────────
app.get('/api/db-status', async (_req, res) => {
    try {
        const userCount = await db_js_1.default.user.count();
        res.json({ status: "connected", userCount });
    }
    catch (error) {
        res.status(500).json({ status: "error", message: error.message });
    }
});
const handleSetup = async (_req, res) => {
    try {
        const results = await seedInitialData();
        res.json({ success: true, status: "success", results });
    }
    catch (error) {
        res.status(500).json({ success: false, status: "error", error: error.message });
    }
};
app.post('/api/setup', handleSetup);
app.get('/api/setup', handleSetup);
// ─── SEED FUNCTION (FIXED) ──────────────────────────────────────────────────────
async function seedInitialData() {
    const logs = [];
    try {
        // 1. Super Admin borligini kafolatlangan findFirst orqali tekshiramiz
        const superAdminExists = await db_js_1.default.user.findFirst({ where: { username: 'superadmin' } });
        if (!superAdminExists) {
            const hash = await bcryptjs_1.default.hash('super@2026', 10);
            await db_js_1.default.user.create({
                data: {
                    username: 'superadmin',
                    passwordHash: hash,
                    plainPassword: 'super@2026',
                    role: 'SUPER_ADMIN',
                    fullName: 'KSB Super Administrator',
                    shopId: null
                }
            });
            logs.push('Super Admin muvaffaqiyatli yaratildi: superadmin / super@2026');
        }
        else {
            logs.push('Super Admin allaqachon mavjud.');
        }
        // 2. Demo do'konni tekshirish va yaratish
        const userCount = await db_js_1.default.user.count({ where: { role: { not: 'SUPER_ADMIN' } } });
        if (userCount === 0) {
            const shop = await db_js_1.default.shop.create({
                data: {
                    name: "KSB POSS DO'KONI",
                    address: "Toshkent sh., Chilonzor tumani",
                    phone: "+998 (99) 123-45-67"
                }
            });
            const adminHash = await bcryptjs_1.default.hash('admin123', 10);
            await db_js_1.default.user.create({
                data: {
                    username: 'admin',
                    passwordHash: adminHash,
                    plainPassword: 'admin123',
                    role: 'ADMIN',
                    fullName: 'Bosh Administrator',
                    shopId: shop.id
                }
            });
            const cashierHash = await bcryptjs_1.default.hash('kassir123', 10);
            await db_js_1.default.user.create({
                data: {
                    username: 'kassir',
                    passwordHash: cashierHash,
                    plainPassword: 'kassir123',
                    role: 'CASHIER',
                    fullName: 'Kassir Gulnoza',
                    shopId: shop.id
                }
            });
            const defaultCat = await db_js_1.default.category.create({
                data: { name: 'Barchasi', shopId: shop.id }
            });
            await db_js_1.default.product.createMany({
                data: [
                    { name: 'Buxanka non', barcode: '40001', categoryId: defaultCat.id, shopId: shop.id, costPrice: 2000, sellingPrice: 3000, stock: 100, unit: 'dona' },
                    { name: 'Coca-Cola 1.5L', barcode: '5449000000996', categoryId: defaultCat.id, shopId: shop.id, costPrice: 9500, sellingPrice: 12500, stock: 80, unit: 'dona' },
                    { name: 'Pepsi 1.5L', barcode: '4780068001016', categoryId: defaultCat.id, shopId: shop.id, costPrice: 9200, sellingPrice: 12000, stock: 60, unit: 'dona' }
                ]
            });
            logs.push('Demo do\'kon va xodimlar yaratildi: admin/admin123, kassir/kassir123');
        }
        else {
            logs.push('Demo foydalanuvchilar bazada mavjud, qayta yozilmadi.');
        }
        return logs;
    }
    catch (err) {
        console.error('Seed error:', err);
        throw err;
    }
}
// Bind to 0.0.0.0 for Wi-Fi sync across devices
app.listen(Number(PORT), '0.0.0.0', async () => {
    console.log(`Backend server running on http://0.0.0.0:${PORT}`);
    try {
        await seedInitialData();
    }
    catch (e) {
        console.error("Avtomatik seed bajarilmadi, lekin server ishlamoqda.");
    }
});

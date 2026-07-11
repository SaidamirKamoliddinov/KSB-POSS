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
// Import Controllers
const auth_controller_js_1 = require("./controllers/auth.controller.js");
const category_controller_js_1 = require("./controllers/category.controller.js");
const product_controller_js_1 = require("./controllers/product.controller.js");
const sale_controller_js_1 = require("./controllers/sale.controller.js");
const report_controller_js_1 = require("./controllers/report.controller.js");
// Import Middleware
const auth_js_1 = require("./middleware/auth.js");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Auth routes
app.post('/api/auth/login', auth_controller_js_1.login);
app.post('/api/auth/register', auth_controller_js_1.register);
app.post('/api/auth/change-password', auth_js_1.authenticateJWT, auth_controller_js_1.changePassword);
// Categories routes
app.get('/api/categories', auth_js_1.authenticateJWT, category_controller_js_1.getCategories);
app.post('/api/categories', auth_js_1.authenticateJWT, (0, auth_js_1.authorizeRoles)('ADMIN'), category_controller_js_1.createCategory);
app.put('/api/categories/:id', auth_js_1.authenticateJWT, (0, auth_js_1.authorizeRoles)('ADMIN'), category_controller_js_1.updateCategory);
app.delete('/api/categories/:id', auth_js_1.authenticateJWT, (0, auth_js_1.authorizeRoles)('ADMIN'), category_controller_js_1.deleteCategory);
// Products routes
app.get('/api/products', auth_js_1.authenticateJWT, product_controller_js_1.getProducts);
app.post('/api/products', auth_js_1.authenticateJWT, (0, auth_js_1.authorizeRoles)('ADMIN'), product_controller_js_1.createProduct);
app.put('/api/products/:id', auth_js_1.authenticateJWT, (0, auth_js_1.authorizeRoles)('ADMIN'), product_controller_js_1.updateProduct);
app.delete('/api/products/:id', auth_js_1.authenticateJWT, (0, auth_js_1.authorizeRoles)('ADMIN'), product_controller_js_1.deleteProduct);
// Sales routes
app.post('/api/sales', auth_js_1.authenticateJWT, sale_controller_js_1.createSale);
app.get('/api/sales', auth_js_1.authenticateJWT, sale_controller_js_1.getSales);
app.get('/api/sales/:id', auth_js_1.authenticateJWT, sale_controller_js_1.getSaleById);
app.delete('/api/sales/:id', auth_js_1.authenticateJWT, (0, auth_js_1.authorizeRoles)('ADMIN'), sale_controller_js_1.deleteSale); // Void sales
// Reports routes
app.get('/api/reports/dashboard', auth_js_1.authenticateJWT, (0, auth_js_1.authorizeRoles)('ADMIN'), report_controller_js_1.getDashboardStats);
// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date() });
});
// Auto seed function for default multitenant shop
async function seedInitialData() {
    try {
        const userCount = await db_js_1.default.user.count();
        if (userCount === 0) {
            console.log('Foydalanuvchilar topilmadi, boshlang\'ich foydalanuvchilar yaratilmoqda...');
            // 1. Create a shop
            const shop = await db_js_1.default.shop.create({
                data: {
                    name: "SKB POSS DO'KONI",
                    address: "Toshkent sh., Chilonzor tumani",
                    phone: "+998 (99) 123-45-67"
                }
            });
            // 2. Create users
            const adminPasswordHash = await bcryptjs_1.default.hash('admin123', 10);
            await db_js_1.default.user.create({
                data: {
                    username: 'admin',
                    passwordHash: adminPasswordHash,
                    role: 'ADMIN',
                    fullName: 'Bosh Administrator',
                    shopId: shop.id
                }
            });
            const cashierPasswordHash = await bcryptjs_1.default.hash('kassir123', 10);
            await db_js_1.default.user.create({
                data: {
                    username: 'kassir',
                    passwordHash: cashierPasswordHash,
                    role: 'CASHIER',
                    fullName: 'Kassir Gulnoza',
                    shopId: shop.id
                }
            });
            // 3. Create default category 'Barchasi' for this shop
            const defaultCategory = await db_js_1.default.category.create({
                data: {
                    name: 'Barchasi',
                    shopId: shop.id
                }
            });
            // 4. Create products linked to the shop & category
            await db_js_1.default.product.createMany({
                data: [
                    {
                        name: 'Buxanka non',
                        barcode: '40001',
                        categoryId: defaultCategory.id,
                        shopId: shop.id,
                        costPrice: 2000,
                        sellingPrice: 3000,
                        stock: 100,
                        unit: 'dona'
                    },
                    {
                        name: 'Patir non',
                        barcode: '40002',
                        categoryId: defaultCategory.id,
                        shopId: shop.id,
                        costPrice: 4000,
                        sellingPrice: 6000,
                        stock: 50,
                        unit: 'dona'
                    },
                    {
                        name: 'Sut 1L 3.2%',
                        barcode: '4780005112233',
                        categoryId: defaultCategory.id,
                        shopId: shop.id,
                        costPrice: 8000,
                        sellingPrice: 11000,
                        stock: 30,
                        unit: 'dona'
                    },
                    {
                        name: 'Coca-Cola 1.5L',
                        barcode: '5449000000996',
                        categoryId: defaultCategory.id,
                        shopId: shop.id,
                        costPrice: 9500,
                        sellingPrice: 12500,
                        stock: 80,
                        unit: 'dona'
                    },
                    {
                        name: 'Pepsi 1.5L',
                        barcode: '4780068001016',
                        categoryId: defaultCategory.id,
                        shopId: shop.id,
                        costPrice: 9200,
                        sellingPrice: 12000,
                        stock: 60,
                        unit: 'dona'
                    }
                ]
            });
            console.log('Boshlang\'ich foydalanuvchilar va tovarlar yaratildi:');
            console.log('- Admin: admin / admin123');
            console.log('- Kassir: kassir / kassir123');
        }
    }
    catch (err) {
        console.error('Seed error:', err);
    }
}
// Bind to 0.0.0.0 for cross-device mobile synchronization over Wi-Fi
app.listen(Number(PORT), '0.0.0.0', async () => {
    console.log(`Backend server running on http://0.0.0.0:${PORT}`);
    await seedInitialData();
});

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
exports.register = register;
exports.changePassword = changePassword;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_js_1 = __importDefault(require("../db.js"));
const JWT_SECRET = process.env.JWT_SECRET || 'skb_poss_secret_key_12345';
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
        // Include shopId in the token
        const token = jsonwebtoken_1.default.sign({
            id: user.id,
            username: user.username,
            role: user.role,
            fullName: user.fullName,
            shopId: user.shopId
        }, JWT_SECRET, { expiresIn: '24h' });
        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                fullName: user.fullName,
                shopId: user.shopId,
                shopName: user.shop.name
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
            return res.status(400).json({ error: 'Barcha majburiy foydalanuvchi maydonlari to\'ldirilishi shart' });
        }
        // Check duplicate username
        const existingUser = await db_js_1.default.user.findUnique({
            where: { username }
        });
        if (existingUser) {
            return res.status(400).json({ error: 'Ushbu foydalanuvchi nomi band' });
        }
        // Use default values if shop settings are not provided in seed (e.g. from backend direct call)
        const finalShopName = shopName || "SKB POSS DO'KONI";
        const finalAddress = address || "Toshkent sh., Chilonzor tumani";
        const finalPhone = phone || "+998 (99) 123-45-67";
        // Hash password
        const salt = await bcryptjs_1.default.genSalt(10);
        const passwordHash = await bcryptjs_1.default.hash(password, salt);
        // Create Shop, User, and default Category in a transaction
        const result = await db_js_1.default.$transaction(async (tx) => {
            // 1. Create shop
            const shop = await tx.shop.create({
                data: {
                    name: finalShopName,
                    address: finalAddress,
                    phone: finalPhone
                }
            });
            // 2. Create user linked to shop
            const user = await tx.user.create({
                data: {
                    username,
                    passwordHash,
                    role,
                    fullName,
                    shopId: shop.id
                }
            });
            // 3. Create default category 'Barchasi' for this shop
            await tx.category.create({
                data: {
                    name: 'Barchasi',
                    shopId: shop.id
                }
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
        if (!userId) {
            return res.status(401).json({ error: 'Avtorizatsiyadan o\'tilmagan' });
        }
        if (!oldPassword || !newPassword) {
            return res.status(400).json({ error: 'Eski va yangi parollar kiritilishi shart' });
        }
        const user = await db_js_1.default.user.findUnique({
            where: { id: userId }
        });
        if (!user) {
            return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
        }
        const isMatch = await bcryptjs_1.default.compare(oldPassword, user.passwordHash);
        if (!isMatch) {
            return res.status(400).json({ error: 'Eski parol xato kiritilgan' });
        }
        const salt = await bcryptjs_1.default.genSalt(10);
        const newHash = await bcryptjs_1.default.hash(newPassword, salt);
        await db_js_1.default.user.update({
            where: { id: userId },
            data: { passwordHash: newHash }
        });
        res.json({ message: 'Parol muvaffaqiyatli o\'zgartirildi' });
    }
    catch (error) {
        console.error('ChangePassword error:', error);
        res.status(500).json({ error: 'Parolni o\'zgartirishda xatolik yuz berdi' });
    }
}

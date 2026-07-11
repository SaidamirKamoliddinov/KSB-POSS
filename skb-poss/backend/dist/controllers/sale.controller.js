"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSale = createSale;
exports.getSales = getSales;
exports.getSaleById = getSaleById;
exports.deleteSale = deleteSale;
const db_js_1 = __importDefault(require("../db.js"));
async function createSale(req, res) {
    try {
        const { items, discountAmount, paymentType, customerName } = req.body;
        const shopId = req.user?.shopId;
        const cashierId = req.user?.id;
        if (!shopId || !cashierId) {
            return res.status(401).json({ error: 'Avtorizatsiyadan o\'tilmagan' });
        }
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Savat bo\'sh. Savatda kamida bitta mahsulot bo\'lishi shart' });
        }
        if (!paymentType || !['CASH', 'CARD', 'CLICK_PAYME'].includes(paymentType)) {
            return res.status(400).json({ error: 'To\'lov turi xato tanlangan' });
        }
        // Process checkout inside a database transaction
        const saleResult = await db_js_1.default.$transaction(async (tx) => {
            // 1. Generate sequential receipt number for this shop
            const count = await tx.sale.count({
                where: { shopId }
            });
            const receiptNumber = `SKB-${count + 1}`;
            let totalAmount = 0;
            const saleItemsData = [];
            for (const item of items) {
                const { productId, quantity } = item;
                const product = await tx.product.findFirst({
                    where: { id: productId, shopId }
                });
                if (!product) {
                    throw new Error(`Mahsulot topilmadi: ID ${productId}`);
                }
                if (product.stock < quantity) {
                    throw new Error(`"${product.name}" mahsulotidan omborda yetarli emas (Mavjud: ${product.stock} ${product.unit})`);
                }
                // Decrement stock
                await tx.product.update({
                    where: { id: productId },
                    data: {
                        stock: {
                            decrement: quantity
                        }
                    }
                });
                const itemTotal = product.sellingPrice * quantity;
                totalAmount += itemTotal;
                saleItemsData.push({
                    productId: product.id,
                    quantity,
                    sellingPrice: product.sellingPrice,
                    costPrice: product.costPrice,
                    total: itemTotal
                });
            }
            // Final amount after discount
            const finalAmount = Math.max(0, totalAmount - (parseFloat(discountAmount) || 0));
            const newSale = await tx.sale.create({
                data: {
                    cashierId,
                    shopId,
                    totalAmount: finalAmount,
                    discountAmount: parseFloat(discountAmount) || 0,
                    paymentType,
                    receiptNumber,
                    customerName: customerName && customerName.trim() !== '' ? customerName.trim() : 'Xaridor',
                    items: {
                        create: saleItemsData
                    }
                },
                include: {
                    items: {
                        include: {
                            product: {
                                select: { name: true, unit: true, barcode: true }
                            }
                        }
                    },
                    cashier: {
                        select: { fullName: true }
                    }
                }
            });
            return newSale;
        });
        res.status(201).json(saleResult);
    }
    catch (error) {
        console.error('createSale error:', error);
        res.status(400).json({ error: error.message || 'Sotuvni yakunlashda xatolik yuz berdi' });
    }
}
async function getSales(req, res) {
    try {
        const shopId = req.user?.shopId;
        if (!shopId) {
            return res.status(401).json({ error: 'Avtorizatsiyadan o\'tilmagan' });
        }
        const sales = await db_js_1.default.sale.findMany({
            where: { shopId },
            include: {
                cashier: {
                    select: { fullName: true }
                },
                _count: {
                    select: { items: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(sales);
    }
    catch (error) {
        console.error('getSales error:', error);
        res.status(500).json({ error: 'Sotuvlar tarixini yuklashda xatolik' });
    }
}
async function getSaleById(req, res) {
    try {
        const { id } = req.params;
        const shopId = req.user?.shopId;
        if (!shopId) {
            return res.status(401).json({ error: 'Avtorizatsiyadan o\'tilmagan' });
        }
        const sale = await db_js_1.default.sale.findFirst({
            where: { id, shopId },
            include: {
                cashier: {
                    select: { fullName: true }
                },
                items: {
                    include: {
                        product: {
                            select: { name: true, unit: true, barcode: true }
                        }
                    }
                }
            }
        });
        if (!sale) {
            return res.status(404).json({ error: 'Chek topilmadi' });
        }
        res.json(sale);
    }
    catch (error) {
        console.error('getSaleById error:', error);
        res.status(500).json({ error: 'Chek tafsilotlarini yuklashda xatolik' });
    }
}
async function deleteSale(req, res) {
    try {
        const { id } = req.params;
        const shopId = req.user?.shopId;
        if (!shopId) {
            return res.status(401).json({ error: 'Avtorizatsiyadan o\'tilmagan' });
        }
        // Verify ownership and load items
        const sale = await db_js_1.default.sale.findFirst({
            where: { id, shopId },
            include: { items: true }
        });
        if (!sale) {
            return res.status(404).json({ error: 'Sotuv cheki topilmadi' });
        }
        // Void sale and restore product stocks inside a transaction
        await db_js_1.default.$transaction(async (tx) => {
            // 1. Restore product stocks
            for (const item of sale.items) {
                await tx.product.update({
                    where: { id: item.productId },
                    data: {
                        stock: {
                            increment: item.quantity
                        }
                    }
                });
            }
            // 2. Delete the sale (Prisma cascade delete handles SaleItems automatically)
            await tx.sale.delete({
                where: { id }
            });
        });
        res.json({ message: 'Sotuv muvaffaqiyatli o\'chirildi va ombor qoldig\'i tiklandi!' });
    }
    catch (error) {
        console.error('deleteSale error:', error);
        res.status(500).json({ error: error.message || 'Sotuv chekini o\'chirishda xatolik yuz berdi' });
    }
}

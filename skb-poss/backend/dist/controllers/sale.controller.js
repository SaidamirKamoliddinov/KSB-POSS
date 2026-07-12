"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSale = createSale;
exports.getSales = getSales;
exports.getSaleById = getSaleById;
exports.deleteSale = deleteSale;
exports.payDebt = payDebt;
exports.clearCustomerDebt = clearCustomerDebt;
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
            const normalizedCustomerName = customerName && customerName.trim() !== '' ? customerName.trim() : 'Xaridor';
            let existingSale = null;
            if (paymentType === 'CARD' && normalizedCustomerName !== 'Xaridor') {
                existingSale = await tx.sale.findFirst({
                    where: {
                        shopId,
                        customerName: normalizedCustomerName,
                        paymentType: 'CARD',
                        isDebtPaid: false
                    },
                    include: {
                        items: true
                    }
                });
            }
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
            const finalAmount = Math.max(0, totalAmount - (parseFloat(discountAmount) || 0));
            if (existingSale) {
                for (const newItem of saleItemsData) {
                    const matchedItem = existingSale.items.find(i => i.productId === newItem.productId);
                    if (matchedItem) {
                        await tx.saleItem.update({
                            where: { id: matchedItem.id },
                            data: {
                                quantity: { increment: newItem.quantity },
                                total: { increment: newItem.total }
                            }
                        });
                    }
                    else {
                        await tx.saleItem.create({
                            data: {
                                saleId: existingSale.id,
                                productId: newItem.productId,
                                quantity: newItem.quantity,
                                sellingPrice: newItem.sellingPrice,
                                costPrice: newItem.costPrice,
                                total: newItem.total
                            }
                        });
                    }
                }
                const updatedSale = await tx.sale.update({
                    where: { id: existingSale.id },
                    data: {
                        totalAmount: { increment: finalAmount },
                        discountAmount: { increment: parseFloat(discountAmount) || 0 }
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
                return updatedSale;
            }
            else {
                const count = await tx.sale.count({
                    where: { shopId }
                });
                const receiptNumber = `KSB-${count + 1}`;
                const newSale = await tx.sale.create({
                    data: {
                        cashierId,
                        shopId,
                        totalAmount: finalAmount,
                        discountAmount: parseFloat(discountAmount) || 0,
                        paymentType,
                        receiptNumber,
                        customerName: normalizedCustomerName,
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
            }
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
async function payDebt(req, res) {
    try {
        const { id } = req.params;
        const shopId = req.user?.shopId;
        if (!shopId)
            return res.status(401).json({ error: 'Avtorizatsiyadan o\'tilmagan' });
        const sale = await db_js_1.default.sale.findFirst({ where: { id, shopId } });
        if (!sale)
            return res.status(404).json({ error: 'Sotuv cheki topilmadi' });
        await db_js_1.default.sale.update({
            where: { id },
            data: { isDebtPaid: true }
        });
        res.json({ message: 'Qarz to\'landi!' });
    }
    catch (error) {
        console.error('payDebt error:', error);
        res.status(500).json({ error: 'Xatolik yuz berdi' });
    }
}
async function clearCustomerDebt(req, res) {
    try {
        const { customerName, paymentAmount } = req.body;
        const shopId = req.user?.shopId;
        if (!shopId)
            return res.status(401).json({ error: 'Avtorizatsiyadan o\'tilmagan' });
        if (!customerName)
            return res.status(400).json({ error: 'Xaridor ismi yuborilmadi' });
        const unpaidSales = await db_js_1.default.sale.findMany({
            where: {
                shopId,
                customerName: customerName.trim(),
                paymentType: 'CARD',
                isDebtPaid: false
            },
            orderBy: {
                createdAt: 'asc'
            }
        });
        if (unpaidSales.length === 0) {
            return res.status(400).json({ error: 'Ushbu xaridorning to\'lanmagan qarzi yo\'q' });
        }
        if (paymentAmount === undefined || paymentAmount === null) {
            // Clear all debts fully
            await db_js_1.default.$transaction(async (tx) => {
                for (const sale of unpaidSales) {
                    await tx.sale.update({
                        where: { id: sale.id },
                        data: {
                            isDebtPaid: true,
                            debtPaidAmount: sale.totalAmount
                        }
                    });
                }
            });
            return res.json({ message: `"${customerName}"ning barcha qarzlari to'liq yopildi!` });
        }
        else {
            const amount = parseFloat(paymentAmount);
            if (isNaN(amount) || amount <= 0) {
                return res.status(400).json({ error: 'To\'lov summasi noto\'g\'ri' });
            }
            let remainingPayment = amount;
            await db_js_1.default.$transaction(async (tx) => {
                for (const sale of unpaidSales) {
                    if (remainingPayment <= 0)
                        break;
                    const currentPaid = sale.debtPaidAmount || 0;
                    const currentRemaining = sale.totalAmount - currentPaid;
                    if (remainingPayment >= currentRemaining) {
                        // This sale's debt is fully covered
                        await tx.sale.update({
                            where: { id: sale.id },
                            data: {
                                isDebtPaid: true,
                                debtPaidAmount: sale.totalAmount
                            }
                        });
                        remainingPayment -= currentRemaining;
                    }
                    else {
                        // Partially cover this sale's debt
                        await tx.sale.update({
                            where: { id: sale.id },
                            data: {
                                debtPaidAmount: currentPaid + remainingPayment
                            }
                        });
                        remainingPayment = 0;
                    }
                }
            });
            return res.json({
                message: `"${customerName}"dan ${amount.toLocaleString()} UZS qarz to'lovi qabul qilindi!`
            });
        }
    }
    catch (error) {
        console.error('clearCustomerDebt error:', error);
        res.status(500).json({ error: 'Qarzni yopishda xatolik yuz berdi' });
    }
}

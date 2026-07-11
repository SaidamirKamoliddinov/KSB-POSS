import { Response } from 'express';
import prisma from '../db.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export async function getDashboardStats(req: AuthenticatedRequest, res: Response) {
  try {
    const shopId = req.user?.shopId;
    if (!shopId) {
      return res.status(401).json({ error: 'Avtorizatsiyadan o\'tilmagan' });
    }

    // 1. Total cumulative metrics
    const sales = await prisma.sale.findMany({
      where: { shopId },
      include: {
        items: true
      }
    });

    let totalRevenue = 0;
    let totalCost = 0;
    let totalDiscount = 0;

    sales.forEach(sale => {
      totalRevenue += sale.totalAmount;
      totalDiscount += sale.discountAmount;
      sale.items.forEach(item => {
        totalCost += item.costPrice * item.quantity;
      });
    });

    const netProfit = totalRevenue - totalCost;

    // 2. Current Calendar Month stats (Updates automatically)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const monthlySales = await prisma.sale.findMany({
      where: {
        shopId,
        createdAt: {
          gte: startOfMonth,
          lte: endOfMonth
        }
      },
      include: {
        items: true
      }
    });

    let monthlyRevenue = 0;
    let monthlyCost = 0;
    monthlySales.forEach(sale => {
      monthlyRevenue += sale.totalAmount;
      sale.items.forEach(item => {
        monthlyCost += item.costPrice * item.quantity;
      });
    });
    const monthlyNetProfit = monthlyRevenue - monthlyCost;

    // 3. Inventory Valuations (Tannarxi, sotish narxi, kutilayotgan foyda)
    const products = await prisma.product.findMany({
      where: { shopId }
    });

    let totalInventoryCostValuation = 0;
    let totalInventorySellingValuation = 0;
    
    products.forEach(p => {
      // If stock is defaulted to 999999 (unlimited), exclude from valuation calculations to avoid massive mock values,
      // or calculate it normally. Let's calculate for products whose stock is not 999999, or calculate normally.
      // If it is 999999, we skip to keep stats realistic!
      if (p.stock < 999999) {
        totalInventoryCostValuation += p.costPrice * p.stock;
        totalInventorySellingValuation += p.sellingPrice * p.stock;
      }
    });

    const expectedProfit = totalInventorySellingValuation - totalInventoryCostValuation;

    // 4. Low stock products (stock <= 5, excluding 999999 default stock)
    const lowStockProducts = await prisma.product.findMany({
      where: {
        shopId,
        stock: { lte: 5 }
      },
      include: {
        category: { select: { name: true } }
      },
      take: 5
    });

    // 5. Chart data: Revenue & Profit grouped by last 7 days
    const last7DaysData = [];
    for (let i = 6; i >= 0; i--) {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - i);

      const end = new Date();
      end.setHours(23, 59, 59, 999);
      end.setDate(end.getDate() - i);

      const daySales = await prisma.sale.findMany({
        where: {
          shopId,
          createdAt: {
            gte: start,
            lte: end
          }
        },
        include: {
          items: true
        }
      });

      let dayRevenue = 0;
      let dayCost = 0;
      daySales.forEach(s => {
        dayRevenue += s.totalAmount;
        s.items.forEach(it => {
          dayCost += it.costPrice * it.quantity;
        });
      });

      const dayProfit = dayRevenue - dayCost;
      const dayName = start.toLocaleDateString('uz-UZ', { weekday: 'short' });

      last7DaysData.push({
        day: dayName,
        date: start.toISOString().slice(5, 10).replace('-', '/'),
        revenue: dayRevenue,
        profit: Math.max(0, dayProfit)
      });
    }

    // 6. Top 5 selling products
    const groupSales = await prisma.saleItem.groupBy({
      by: ['productId'],
      _sum: {
        quantity: true,
        total: true
      },
      orderBy: {
        _sum: {
          quantity: 'desc'
        }
      },
      take: 5
    });

    const topProducts = [];
    for (const gs of groupSales) {
      const prod = await prisma.product.findFirst({
        where: { id: gs.productId, shopId },
        select: { name: true }
      });
      if (prod) {
        topProducts.push({
          name: prod.name,
          quantity: gs._sum.quantity || 0,
          totalSales: gs._sum.total || 0
        });
      }
    }

    res.json({
      summary: {
        totalRevenue,
        netProfit,
        totalSalesCount: sales.length,
        totalDiscount
      },
      monthlySummary: {
        monthlyRevenue,
        monthlyNetProfit
      },
      inventoryValuation: {
        costValuation: totalInventoryCostValuation,
        sellingValuation: totalInventorySellingValuation,
        expectedProfit
      },
      lowStockProducts,
      chartData: last7DaysData,
      topProducts
    });
  } catch (error) {
    console.error('getDashboardStats error:', error);
    res.status(500).json({ error: 'Statistikani yuklashda xatolik yuz berdi' });
  }
}

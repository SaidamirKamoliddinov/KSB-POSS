const dotenv = require('dotenv');
dotenv.config();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    include: {
      category: true
    }
  });
  console.log("Total products in DB:", products.length);
  console.log("First 10 products in DB:");
  products.slice(0, 10).forEach(p => {
    console.log(`- ${p.name} (Barcode: ${p.barcode}) Category: ${p.category?.name}`);
  });
  await prisma.$disconnect();
}

main().catch(console.error);

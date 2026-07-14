"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProducts = getProducts;
exports.createProduct = createProduct;
exports.updateProduct = updateProduct;
exports.deleteProduct = deleteProduct;
exports.lookupBarcode = lookupBarcode;
exports.getGlobalBarcodes = getGlobalBarcodes;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const db_js_1 = __importDefault(require("../db.js"));
async function getProducts(req, res) {
    try {
        const { search } = req.query;
        const shopId = req.user?.shopId;
        if (!shopId) {
            return res.status(401).json({ error: 'Avtorizatsiyadan o\'tilmagan' });
        }
        const whereClause = { shopId };
        if (search && typeof search === 'string' && search !== '') {
            whereClause.OR = [
                { name: { contains: search } },
                { barcode: { contains: search } }
            ];
        }
        const products = await db_js_1.default.product.findMany({
            where: whereClause,
            include: {
                category: {
                    select: { name: true }
                }
            },
            orderBy: { name: 'asc' }
        });
        res.json(products);
    }
    catch (error) {
        console.error('getProducts error:', error);
        res.status(500).json({ error: 'Mahsulotlarni yuklashda xatolik yuz berdi' });
    }
}
async function createProduct(req, res) {
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
            let defaultCat = await db_js_1.default.category.findFirst({
                where: { name: 'Barchasi', shopId }
            });
            if (!defaultCat) {
                defaultCat = await db_js_1.default.category.create({
                    data: { name: 'Barchasi', shopId }
                });
            }
            finalCategoryId = defaultCat.id;
        }
        // Check barcode duplicate per shop
        if (barcode && barcode.trim() !== '') {
            const existing = await db_js_1.default.product.findFirst({
                where: { barcode: barcode.trim(), shopId }
            });
            if (existing) {
                return res.status(400).json({ error: 'Ushbu shtrix-kodga ega mahsulot do\'konda allaqachon mavjud' });
            }
        }
        const product = await db_js_1.default.product.create({
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
    }
    catch (error) {
        console.error('createProduct error:', error);
        res.status(500).json({ error: 'Mahsulot yaratishda xatolik yuz berdi' });
    }
}
async function updateProduct(req, res) {
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
        const productToUpdate = await db_js_1.default.product.findFirst({
            where: { id, shopId }
        });
        if (!productToUpdate) {
            return res.status(404).json({ error: 'Mahsulot topilmadi' });
        }
        // Auto-resolve default Category ID if not sent by UI
        let finalCategoryId = categoryId;
        if (!finalCategoryId) {
            let defaultCat = await db_js_1.default.category.findFirst({
                where: { name: 'Barchasi', shopId }
            });
            if (!defaultCat) {
                defaultCat = await db_js_1.default.category.create({
                    data: { name: 'Barchasi', shopId }
                });
            }
            finalCategoryId = defaultCat.id;
        }
        // Check barcode duplicate per shop
        if (barcode && barcode.trim() !== '') {
            const existing = await db_js_1.default.product.findFirst({
                where: { barcode: barcode.trim(), shopId }
            });
            if (existing && existing.id !== id) {
                return res.status(400).json({ error: 'Ushbu shtrix-kodga ega mahsulot do\'konda allaqachon mavjud' });
            }
        }
        const product = await db_js_1.default.product.update({
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
    }
    catch (error) {
        console.error('updateProduct error:', error);
        res.status(500).json({ error: 'Mahsulotni tahrirlashda xatolik yuz berdi' });
    }
}
async function deleteProduct(req, res) {
    try {
        const { id } = req.params;
        const shopId = req.user?.shopId;
        if (!shopId) {
            return res.status(401).json({ error: 'Avtorizatsiyadan o\'tilmagan' });
        }
        // Check ownership
        const productToDelete = await db_js_1.default.product.findFirst({
            where: { id, shopId }
        });
        if (!productToDelete) {
            return res.status(404).json({ error: 'Mahsulot topilmadi' });
        }
        // Check if the product has ever been sold
        const saleItemsCount = await db_js_1.default.saleItem.count({
            where: { productId: id }
        });
        if (saleItemsCount > 0) {
            return res.status(400).json({ error: 'Ushbu mahsulot sotilganligi sababli uni o\'chirib bo\'lmaydi' });
        }
        await db_js_1.default.product.delete({
            where: { id }
        });
        res.json({ message: 'Mahsulot muvaffaqiyatli o\'chirildi' });
    }
    catch (error) {
        console.error('deleteProduct error:', error);
        res.status(500).json({ error: 'Mahsulotni o\'chirishda xatolik yuz berdi' });
    }
}
function capitalizeFirstLetter(str) {
    if (!str)
        return '';
    const trimmed = str.trim();
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}
function cleanName(str) {
    if (!str)
        return '';
    const parts = str.split(':');
    let cleaned = parts[parts.length - 1].trim();
    // Clean up case-insensitive brand duplicates like "Coca-Cola Coca-Cola"
    cleaned = cleaned.replace(/(coca-cola|pepsi|sprite|fanta)\s+\1/gi, '$1');
    cleaned = cleaned.replace(/(coca\s+cola)\s+\1/gi, '$1');
    cleaned = cleaned.replace(/(coca)\s+(coca-cola)/gi, '$2');
    cleaned = cleaned.replace(/(coca)\s+(coca\s+cola)/gi, '$2');
    // Replace double spaces
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned;
}
async function lookupBarcode(req, res) {
    try {
        const { barcode } = req.params;
        const shopId = req.user?.shopId;
        if (!shopId) {
            return res.status(401).json({ error: 'Avtorizatsiyadan o\'tilmagan' });
        }
        if (!barcode || barcode.trim() === '') {
            return res.status(400).json({ error: 'Shtrix-kod taqdim etilmagan' });
        }
        const cleanBarcode = barcode.trim();
        // 0. Search local barcode registry file first
        try {
            const pathsToTry = [
                path_1.default.join(process.cwd(), 'src/barcode_registry.json'),
                path_1.default.join(process.cwd(), 'dist/barcode_registry.json'),
                path_1.default.join(process.cwd(), 'barcode_registry.json')
            ];
            let registryPath = '';
            for (const p of pathsToTry) {
                if (fs_1.default.existsSync(p)) {
                    registryPath = p;
                    break;
                }
            }
            if (registryPath) {
                const registryData = JSON.parse(fs_1.default.readFileSync(registryPath, 'utf8'));
                if (registryData[cleanBarcode]) {
                    return res.json({ name: capitalizeFirstLetter(registryData[cleanBarcode]) });
                }
            }
        }
        catch (registryError) {
            console.warn('Barcode registry file error:', registryError);
        }
        // 1. Search local DB first
        const dbMatch = await db_js_1.default.product.findFirst({
            where: { barcode: cleanBarcode },
            select: { name: true }
        });
        if (dbMatch && dbMatch.name) {
            return res.json({ name: capitalizeFirstLetter(dbMatch.name) });
        }
        // 2. Fetch from Soliq (Uzbekistan Tax Committee) Elasticsearch API (Free & local to Uzbekistan)
        try {
            const soliqResponse = await fetch(`https://tasnif.soliq.uz/api/cls-api/elasticsearch/search?search=${cleanBarcode}&size=10&page=0&lang=uz`);
            if (soliqResponse.ok) {
                const soliqData = await soliqResponse.json();
                if (soliqData && Array.isArray(soliqData.data)) {
                    const match = soliqData.data.find((item) => item.internationalCode === cleanBarcode ||
                        (item.fullName && item.fullName.includes(cleanBarcode)));
                    if (match && match.name) {
                        const cleanedName = cleanName(match.name);
                        if (cleanedName) {
                            return res.json({ name: capitalizeFirstLetter(cleanedName) });
                        }
                    }
                }
            }
        }
        catch (soliqError) {
            console.warn('Soliq API error:', soliqError);
        }
        // 3. Fetch from Open Food Facts API (Good for foods/beverages)
        try {
            const offResponse = await fetch(`https://world.openfoodfacts.org/api/v2/product/${cleanBarcode}?fields=product_name`);
            if (offResponse.ok) {
                const offData = await offResponse.json();
                if (offData && offData.product && offData.product.product_name) {
                    return res.json({ name: capitalizeFirstLetter(offData.product.product_name) });
                }
            }
        }
        catch (offError) {
            console.warn('Open Food Facts API error:', offError);
        }
        // 3. Fetch from Open Beauty Facts API (Good for cosmetics, personal care, cotton swabs/uxachiska, hygiene)
        try {
            const obfResponse = await fetch(`https://world.openbeautyfacts.org/api/v2/product/${cleanBarcode}?fields=product_name`);
            if (obfResponse.ok) {
                const obfData = await obfResponse.json();
                if (obfData && obfData.product && obfData.product.product_name) {
                    return res.json({ name: capitalizeFirstLetter(obfData.product.product_name) });
                }
            }
        }
        catch (obfError) {
            console.warn('Open Beauty Facts API error:', obfError);
        }
        // 4. Fetch from Open Products Facts API (Good for general non-food items, household products)
        try {
            const opfResponse = await fetch(`https://world.openproductsfacts.org/api/v2/product/${cleanBarcode}?fields=product_name`);
            if (opfResponse.ok) {
                const opfData = await opfResponse.json();
                if (opfData && opfData.product && opfData.product.product_name) {
                    return res.json({ name: capitalizeFirstLetter(opfData.product.product_name) });
                }
            }
        }
        catch (opfError) {
            console.warn('Open Products Facts API error:', opfError);
        }
        // 5. Fetch from UPCitemdb API (Good for general merchandise)
        try {
            const upcResponse = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${cleanBarcode}`);
            if (upcResponse.ok) {
                const upcData = await upcResponse.json();
                if (upcData && upcData.items && upcData.items.length > 0 && upcData.items[0].title) {
                    return res.json({ name: capitalizeFirstLetter(upcData.items[0].title) });
                }
            }
        }
        catch (upcError) {
            console.warn('UPCitemdb API error:', upcError);
        }
        return res.json({ name: '' });
    }
    catch (error) {
        console.error('lookupBarcode error:', error);
        res.status(500).json({ error: 'Shtrix-kod qidirishda xatolik yuz berdi' });
    }
}
async function getGlobalBarcodes(req, res) {
    try {
        const pathsToTry = [
            path_1.default.join(process.cwd(), 'src/barcode_registry.json'),
            path_1.default.join(process.cwd(), 'dist/barcode_registry.json'),
            path_1.default.join(process.cwd(), 'barcode_registry.json')
        ];
        let registryPath = '';
        for (const p of pathsToTry) {
            if (fs_1.default.existsSync(p)) {
                registryPath = p;
                break;
            }
        }
        if (registryPath) {
            const registryData = JSON.parse(fs_1.default.readFileSync(registryPath, 'utf8'));
            const list = Object.keys(registryData).map(key => ({
                barcode: key,
                name: capitalizeFirstLetter(registryData[key])
            }));
            return res.json(list);
        }
        return res.json([]);
    }
    catch (error) {
        console.error('getGlobalBarcodes error:', error);
        res.status(500).json({ error: 'Shtrix-kodlarni yuklashda xatolik' });
    }
}

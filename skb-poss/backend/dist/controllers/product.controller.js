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
exports.checkAndSaveCrowdsourcedBarcode = checkAndSaveCrowdsourcedBarcode;
exports.getCrowdsourcedBarcodes = getCrowdsourcedBarcodes;
exports.deleteCrowdsourcedBarcode = deleteCrowdsourcedBarcode;
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
        if (product.barcode) {
            checkAndSaveCrowdsourcedBarcode(product.barcode, product.name, shopId).catch(() => { });
        }
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
                    return res.json({
                        name: capitalizeFirstLetter(registryData[cleanBarcode]),
                        originalName: registryData[cleanBarcode],
                        source: 'Tizim ma\'lumotlar bazasi (Registry)'
                    });
                }
            }
        }
        catch (registryError) {
            console.warn('Barcode registry file error:', registryError);
        }
        // 0.5 Check crowdsourced barcodes database
        try {
            const crowdMatch = await db_js_1.default.crowdsourcedBarcode.findUnique({
                where: { barcode: cleanBarcode }
            });
            if (crowdMatch && crowdMatch.name) {
                return res.json({
                    name: capitalizeFirstLetter(crowdMatch.name),
                    originalName: crowdMatch.name,
                    source: `Foydalanuvchilardan (${crowdMatch.shopName || "Tizim"})`
                });
            }
        }
        catch (crowdErr) {
            console.warn('Crowdsourced database check error:', crowdErr);
        }
        // 1. Search local DB first
        const dbMatch = await db_js_1.default.product.findFirst({
            where: { barcode: cleanBarcode },
            select: { name: true }
        });
        if (dbMatch && dbMatch.name) {
            return res.json({
                name: capitalizeFirstLetter(dbMatch.name),
                originalName: dbMatch.name,
                source: 'Do\'koningiz maxsus ma\'lumotlar bazasi (DB)'
            });
        }
        // 2. Fetch from Soliq (Uzbekistan Tax Committee) Elasticsearch API
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
                            await checkAndSaveCrowdsourcedBarcode(cleanBarcode, cleanedName, shopId);
                            return res.json({
                                name: capitalizeFirstLetter(cleanedName),
                                originalName: match.name,
                                source: 'Soliq (Tasnif) ma\'lumotlar bazasi'
                            });
                        }
                    }
                }
            }
        }
        catch (soliqError) {
            console.warn('Soliq API error:', soliqError);
        }
        // 3. Fetch from Open Food Facts API
        try {
            const offResponse = await fetch(`https://world.openfoodfacts.org/api/v2/product/${cleanBarcode}?fields=product_name`);
            if (offResponse.ok) {
                const offData = await offResponse.json();
                if (offData && offData.product && offData.product.product_name) {
                    const nameVal = offData.product.product_name;
                    await checkAndSaveCrowdsourcedBarcode(cleanBarcode, nameVal, shopId);
                    return res.json({
                        name: capitalizeFirstLetter(nameVal),
                        originalName: nameVal,
                        source: 'Open Food Facts (Xalqaro oziq-ovqat bazasi)'
                    });
                }
            }
        }
        catch (offError) {
            console.warn('Open Food Facts API error:', offError);
        }
        // 3. Fetch from Open Beauty Facts API
        try {
            const obfResponse = await fetch(`https://world.openbeautyfacts.org/api/v2/product/${cleanBarcode}?fields=product_name`);
            if (obfResponse.ok) {
                const obfData = await obfResponse.json();
                if (obfData && obfData.product && obfData.product.product_name) {
                    const nameVal = obfData.product.product_name;
                    await checkAndSaveCrowdsourcedBarcode(cleanBarcode, nameVal, shopId);
                    return res.json({
                        name: capitalizeFirstLetter(nameVal),
                        originalName: nameVal,
                        source: 'Open Beauty Facts (Kosmetika bazasi)'
                    });
                }
            }
        }
        catch (obfError) {
            console.warn('Open Beauty Facts API error:', obfError);
        }
        // 4. Fetch from Open Products Facts API
        try {
            const opfResponse = await fetch(`https://world.openproductsfacts.org/api/v2/product/${cleanBarcode}?fields=product_name`);
            if (opfResponse.ok) {
                const opfData = await opfResponse.json();
                if (opfData && opfData.product && opfData.product.product_name) {
                    const nameVal = opfData.product.product_name;
                    await checkAndSaveCrowdsourcedBarcode(cleanBarcode, nameVal, shopId);
                    return res.json({
                        name: capitalizeFirstLetter(nameVal),
                        originalName: nameVal,
                        source: 'Open Products Facts (Xalqaro tovarlar bazasi)'
                    });
                }
            }
        }
        catch (opfError) {
            console.warn('Open Products Facts API error:', opfError);
        }
        // 5. Fetch from UPCitemdb API
        try {
            const upcResponse = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${cleanBarcode}`);
            if (upcResponse.ok) {
                const upcData = await upcResponse.json();
                if (upcData && upcData.items && upcData.items.length > 0 && upcData.items[0].title) {
                    const nameVal = upcData.items[0].title;
                    await checkAndSaveCrowdsourcedBarcode(cleanBarcode, nameVal, shopId);
                    return res.json({
                        name: capitalizeFirstLetter(nameVal),
                        originalName: nameVal,
                        source: 'UPCitemdb (Xalqaro tovarlar bazasi)'
                    });
                }
            }
        }
        catch (upcError) {
            console.warn('UPCitemdb API error:', upcError);
        }
        return res.json({ name: '', originalName: '', source: '' });
    }
    catch (error) {
        console.error('lookupBarcode error:', error);
        res.status(500).json({ error: 'Shtrix-kod qidirishda xatolik yuz berdi' });
    }
}
async function getGlobalBarcodes(req, res) {
    try {
        const registry = getRegistry();
        const map = new Map();
        // 1. Add registry entries
        for (const [barcode, name] of Object.entries(registry)) {
            map.set(barcode, {
                barcode,
                name: capitalizeFirstLetter(name),
                shopName: 'Global Bazadan'
            });
        }
        // 2. Add products created by any shop in database
        const dbProducts = await db_js_1.default.product.findMany({
            where: {
                barcode: { not: null }
            },
            include: {
                shop: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        for (const p of dbProducts) {
            if (p.barcode && p.barcode.trim()) {
                map.set(p.barcode.trim(), {
                    barcode: p.barcode.trim(),
                    name: capitalizeFirstLetter(p.name),
                    shopName: p.shop?.name || 'Do\'kon'
                });
            }
        }
        const list = Array.from(map.values());
        res.json(list);
    }
    catch (error) {
        console.error('getGlobalBarcodes error:', error);
        res.status(500).json({ error: 'Shtrix-kodlarni yuklashda xatolik' });
    }
}
let cachedRegistry = null;
function getRegistry() {
    if (cachedRegistry)
        return cachedRegistry;
    const pathsToTry = [
        path_1.default.join(process.cwd(), 'src/barcode_registry.json'),
        path_1.default.join(process.cwd(), 'dist/barcode_registry.json'),
        path_1.default.join(process.cwd(), 'barcode_registry.json'),
        path_1.default.join(process.cwd(), 'backend/src/barcode_registry.json'),
        path_1.default.join(process.cwd(), 'backend/barcode_registry.json')
    ];
    for (const p of pathsToTry) {
        if (fs_1.default.existsSync(p)) {
            try {
                cachedRegistry = JSON.parse(fs_1.default.readFileSync(p, 'utf8'));
                return cachedRegistry;
            }
            catch { }
        }
    }
    cachedRegistry = {};
    return cachedRegistry;
}
async function checkAndSaveCrowdsourcedBarcode(barcode, name, shopId) {
    if (!barcode)
        return;
    const trimmed = barcode.trim();
    if (trimmed === '' || trimmed.length < 4)
        return;
    try {
        // 1. Check if already in global registry
        const reg = getRegistry();
        if (reg[trimmed])
            return;
        // 2. Check if already in CrowdsourcedBarcode table
        const existingCrowd = await db_js_1.default.crowdsourcedBarcode.findUnique({
            where: { barcode: trimmed }
        });
        if (existingCrowd)
            return;
        // Fetch shop name
        const shop = await db_js_1.default.shop.findUnique({
            where: { id: shopId },
            select: { name: true }
        });
        // 3. Create entry in CrowdsourcedBarcode
        await db_js_1.default.crowdsourcedBarcode.create({
            data: {
                barcode: trimmed,
                name: name.trim(),
                shopName: shop?.name || 'Noma\'lum do\'kon'
            }
        });
    }
    catch (error) {
        console.warn('checkAndSaveCrowdsourcedBarcode warning:', error);
    }
}
async function getCrowdsourcedBarcodes(req, res) {
    try {
        const list = [];
        const seenBarcodes = new Set();
        // 1. Fetch entries from CrowdsourcedBarcode table
        const crowdList = await db_js_1.default.crowdsourcedBarcode.findMany({
            orderBy: { createdAt: 'desc' }
        });
        for (const c of crowdList) {
            if (c.barcode)
                seenBarcodes.add(c.barcode.trim());
            list.push({
                id: c.id,
                barcode: c.barcode,
                name: capitalizeFirstLetter(c.name),
                shopName: c.shopName || 'Foydalanuvchi',
                createdAt: c.createdAt
            });
        }
        // 2. Fetch ALL products created across all shops (including user 1313)
        const dbProducts = await db_js_1.default.product.findMany({
            include: {
                shop: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        for (const p of dbProducts) {
            const barcodeStr = p.barcode && p.barcode.trim() !== '' ? p.barcode.trim() : 'Shtrix-kod biriktirilmagan';
            if (!p.barcode || !seenBarcodes.has(p.barcode.trim())) {
                if (p.barcode)
                    seenBarcodes.add(p.barcode.trim());
                list.push({
                    id: p.id,
                    barcode: barcodeStr,
                    name: capitalizeFirstLetter(p.name),
                    shopName: p.shop?.name || 'Do\'kon',
                    createdAt: p.createdAt
                });
            }
        }
        res.json(list);
    }
    catch (error) {
        console.error('getCrowdsourcedBarcodes error:', error);
        res.status(500).json({ error: 'Foydalanuvchilardan qo\'shilgan mahsulotlarni yuklashda xatolik' });
    }
}
async function deleteCrowdsourcedBarcode(req, res) {
    try {
        const { id } = req.params;
        await db_js_1.default.crowdsourcedBarcode.delete({
            where: { id }
        });
        res.json({ message: 'Muvaffaqiyatli o\'chirildi' });
    }
    catch (error) {
        console.error('deleteCrowdsourcedBarcode error:', error);
        res.status(500).json({ error: 'O\'chirishda xatolik yuz berdi' });
    }
}

import React, { useState, useEffect, useRef } from 'react';
import { API_URL } from '../config.js';
import { 
  Bar, Line, Doughnut 
} from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { 
  TrendingUp, DollarSign, Package, ShoppingBag, AlertTriangle, 
  Trash2, Edit, Plus, X, Settings, FileText, Lock, Printer, Eye, EyeOff, Table, Search,
  Archive, FolderArchive, ChevronDown, ChevronUp
} from 'lucide-react';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

export default function Dashboard({ token, user }) {
  const [activeTab, setActiveTab] = useState('analytics'); // 'analytics' | 'inventory' | 'sales' | 'debts' | 'settings'
  const [stats, setStats] = useState(null);
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePrintLabel, setActivePrintLabel] = useState(null);
  const [inventorySearch, setInventorySearch] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState(new Set());
  const [debtPayInputs, setDebtPayInputs] = useState({});
  const barcodeTimeoutRef = useRef(null);
  const bulkBarcodeTimeoutRefs = useRef({});

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  // Telegram Bot settings
  const [tgBotToken, setTgBotToken] = useState('');
  
  // Sale Detail Modal State
  const [selectedSaleDetail, setSelectedSaleDetail] = useState(null);

  const [showOldPw, setShowOldPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  // PIN code state
  const [pinInput, setPinInput] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const pinKey = user?.id ? `pin_${user.id}` : null;
  const currentPin = pinKey ? localStorage.getItem(pinKey) : null;

  // Forms states
  const [productForm, setProductForm] = useState({
    id: '',
    name: '',
    barcode: '',
    costPrice: '',
    sellingPrice: '',
    stock: '999999',
    unit: 'dona',
  });
  
  const [showProductModal, setShowProductModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [barcodeSourceInfo, setBarcodeSourceInfo] = useState(null);

  // PWA & Archive States
  const [archiveSales, setArchiveSales] = useState([]);
  const [showArchiveClearModal, setShowArchiveClearModal] = useState(false);
  const [archiveClearPassword, setArchiveClearPassword] = useState('');
  const [expandedMonths, setExpandedMonths] = useState(new Set());

  // Bulk products list state for table insertion (initially 10 rows)
  const createEmptyBulkRow = () => ({ name: '', barcode: '', costPrice: '', sellingPrice: '', stock: '999999', unit: 'dona' });
  const create10EmptyBulkRows = () => Array.from({ length: 10 }, createEmptyBulkRow);
  const [bulkRows, setBulkRows] = useState(create10EmptyBulkRows());

  // Settings State
  const [receiptWidth, setReceiptWidth] = useState('80mm');
  const [labelSize, setLabelSize] = useState('40x30mm');
  const [shopName, setShopName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [printReceipt, setPrintReceipt] = useState(true);
  
  // Password change state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [tgChatId, setTgChatId] = useState('');

  useEffect(() => {
    fetchStats();
    fetchProducts();
    fetchSales();
    fetchArchiveSales();
    loadShopSettings();
  }, []);

  // ─── ARCHIVE SALES METHODS ───────────────────────────────────────────────────
  const fetchArchiveSales = async () => {
    try {
      const res = await fetch(`${API_URL}/sales/archive`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setArchiveSales(data);
      }
    } catch (err) {
      console.error('fetchArchiveSales error:', err);
    }
  };

  const handleClearArchive = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`${API_URL}/sales/archive/clear`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ password: archiveClearPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Arxivni tozalashda xatolik yuz berdi');

      setSuccess(data.message || 'Arxiv muvaffaqiyatli tozalandi!');
      setArchiveClearPassword('');
      setShowArchiveClearModal(false);
      fetchArchiveSales();
      fetchStats();
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError(err.message || 'Xatolik yuz berdi');
      setTimeout(() => setError(''), 2000);
    }
  };

  const getGroupedArchiveSales = () => {
    const groups = {};
    const monthsUz = {
      '01': 'Yanvar', '02': 'Fevral', '03': 'Mart', '04': 'Aprel',
      '05': 'May', '06': 'Iyun', '07': 'Iyul', '08': 'Avgust',
      '09': 'Sentabr', '10': 'Oktabr', '11': 'Noyabr', '12': 'Dekabr'
    };

    archiveSales.forEach(sale => {
      const dt = new Date(sale.createdAt);
      const year = dt.getFullYear();
      const monthNum = String(dt.getMonth() + 1).padStart(2, '0');
      const monthName = monthsUz[monthNum] || 'Noma\'lum';
      const groupKey = `${year}-${monthNum}`;
      const groupLabel = `${monthName} ${year}`;

      if (!groups[groupKey]) {
        groups[groupKey] = {
          label: groupLabel,
          sales: [],
          totalAmount: 0,
          totalDiscount: 0
        };
      }

      groups[groupKey].sales.push(sale);
      groups[groupKey].totalAmount += sale.totalAmount;
      groups[groupKey].totalDiscount += sale.discountAmount;
    });

    return Object.keys(groups)
      .sort((a, b) => b.localeCompare(a))
      .map(key => ({
        key,
        ...groups[key]
      }));
  };

  // (activePrintLabel is no longer used — openLabelPrintWindow is called directly)

  const loadShopSettings = async () => {
    try {
      const localSaved = JSON.parse(localStorage.getItem('shopSettings')) || {};
      setPrintReceipt(localSaved.printReceipt !== false);
      setReceiptWidth(localSaved.receiptWidth || '80mm');
      setLabelSize(localSaved.labelSize || '40x30mm');

      const res = await fetch(`${API_URL}/shop`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setShopName(data.name || '');
        setAddress(data.address || '');
        setPhone(data.phone || '');
        setTgBotToken(data.tgBotToken || '');
        setTgChatId(data.tgChatId || '');

        localStorage.setItem('shopSettings', JSON.stringify({
          ...localSaved,
          shopName: data.name,
          address: data.address,
          phone: data.phone,
          tgBotToken: data.tgBotToken,
          tgChatId: data.tgChatId,
          printReceipt: localSaved.printReceipt !== false,
          receiptWidth: localSaved.receiptWidth || '80mm',
          labelSize: localSaved.labelSize || '40x30mm'
        }));
      } else {
        const saved = JSON.parse(localStorage.getItem('shopSettings')) || {
          shopName: "KSB POSS DO'KONI",
          address: "Toshkent sh., Chilonzor tumani",
          phone: "+998 (99) 123-45-67",
          printReceipt: true,
          receiptWidth: '80mm',
          labelSize: '40x30mm',
          tgBotToken: '',
          tgChatId: ''
        };
        setShopName(saved.shopName);
        setAddress(saved.address);
        setPhone(saved.phone);
        setPrintReceipt(saved.printReceipt !== false);
        setReceiptWidth(saved.receiptWidth || '80mm');
        setLabelSize(saved.labelSize || '40x30mm');
        setTgBotToken(saved.tgBotToken || '');
        setTgChatId(saved.tgChatId || '');
      }
    } catch (err) {
      console.error('loadShopSettings error:', err);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`${API_URL}/shop`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          shopName: shopName.trim(),
          address: address.trim(),
          phone: phone.trim(),
          tgBotToken: tgBotToken.trim(),
          tgChatId: tgChatId.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sozlamalarni saqlashda xatolik');

      const shopSettings = {
        shopName: data.name,
        address: data.address,
        phone: data.phone,
        printReceipt,
        receiptWidth,
        labelSize,
        tgBotToken: data.tgBotToken,
        tgChatId: data.tgChatId
      };

      localStorage.setItem('shopSettings', JSON.stringify(shopSettings));
      setSuccess('Sozlamalar muvaffaqiyatli saqlandi!');
      setTimeout(() => setSuccess(''), 1500);
    } catch (err) {
      setError(err.message || 'Xatolik yuz berdi');
      setTimeout(() => setError(''), 2000);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!oldPassword || !newPassword) {
      setError('Eski va yangi parollar kiritilishi shart');
      setTimeout(() => setError(''), 1500);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ oldPassword, newPassword })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Parolni o\'zgartirishda xatolik');

      setSuccess('Parol muvaffaqiyatli yangilandi!');
      setOldPassword('');
      setNewPassword('');
      setTimeout(() => setSuccess(''), 1500);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(''), 1500);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_URL}/reports/dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setStats(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API_URL}/products`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setProducts(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSales = async () => {
    try {
      const res = await fetch(`${API_URL}/sales`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setSales(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleProductSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const url = productForm.id 
      ? `${API_URL}/products/${productForm.id}` 
      : `${API_URL}/products`;
    const method = productForm.id ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(productForm)
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Amalni bajarishda xatolik yuz berdi');

      setSuccess(productForm.id ? 'Mahsulot yangilandi!' : 'Yangi mahsulot qo\'shildi!');
      setShowProductModal(false);
      resetProductForm();
      fetchProducts();
      fetchStats();
      setTimeout(() => setSuccess(''), 1500);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(''), 1500);
    }
  };

  const deleteProduct = async (id) => {
    if (!window.confirm('Haqiqatdan ham ushbu mahsulotni o\'chirmoqchimisiz?')) return;
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`${API_URL}/products/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSuccess('Mahsulot muvaffaqiyatli o\'chirildi!');
      fetchProducts();
      fetchStats();
      setTimeout(() => setSuccess(''), 1500);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(''), 1500);
    }
  };

  const deleteSaleRecord = async (saleId) => {
    if (!window.confirm('Sotuv chekini o\'chirmoqchimisiz? Chek o\'chirilganda undagi mahsulotlar qoldig\'i omborga qaytariladi!')) return;
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`${API_URL}/sales/${saleId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sotuvni o\'chirishda xatolik');

      setSuccess('Sotuv muvaffaqiyatli o\'chirildi!');
      fetchSales();
      fetchProducts();
      fetchStats();
      setTimeout(() => setSuccess(''), 1500);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(''), 1500);
    }
  };

  const handleClearCustomerDebt = async (customerName, paymentAmount) => {
    const isPartial = paymentAmount !== undefined && paymentAmount !== null;
    if (!isPartial) {
      if (!window.confirm(`Haqiqatdan ham "${customerName}" ning barcha qarzlarini yopmoqchimisiz?`)) return;
    }
    setError('');
    setSuccess('');
    try {
      const body = { customerName };
      if (isPartial) body.paymentAmount = parseFloat(paymentAmount);
      const res = await fetch(`${API_URL}/sales/clear-debt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Qarzni yopishda xatolik yuz berdi');

      setSuccess(data.message || 'Qarz to\'lovi qabul qilindi!');
      // Clear payment input for this customer
      setDebtPayInputs(prev => { const n = { ...prev }; delete n[customerName]; return n; });
      fetchSales();
      fetchStats();
      setTimeout(() => setSuccess(''), 2500);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(''), 1500);
    }
  };

  const viewSaleDetails = async (saleId) => {
    try {
      const res = await fetch(`${API_URL}/sales/${saleId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setSelectedSaleDetail(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const resetProductForm = () => {
    setProductForm({
      id: '',
      name: '',
      barcode: '',
      costPrice: '',
      sellingPrice: '',
      stock: '999999',
      unit: 'dona',
    });
    setBarcodeSourceInfo(null);
  };

  const openEditProduct = (prod) => {
    setProductForm({
      id: prod.id,
      name: prod.name,
      barcode: prod.barcode || '',
      costPrice: prod.costPrice,
      sellingPrice: prod.sellingPrice,
      stock: prod.stock,
      unit: prod.unit,
    });
    setBarcodeSourceInfo(null);
    setShowProductModal(true);
  };

  // Opens a new window with premium label markup for given list of products and triggers print
  const openLabelPrintWindow = (productList) => {
    const shopDisplayName = shopName || "KSB POSS DO'KONI";
    const shopAddr = address || '';

    // Extract width and height from labelSize, e.g. "40x30mm"
    const [widthStr, heightStr] = labelSize.split('x');
    const widthVal = widthStr || '40mm';
    const heightVal = heightStr || '30mm';
    
    // Calculate a scale factor based on the height
    const hNum = parseFloat(heightVal) || 30;
    const scale = hNum / 30.0;

    const labelsHtml = productList.map(prod => {
      // Generate barcode bars: alternate thin/thick bars for realistic look
      const barcode = prod.barcode || prod.id.slice(0, 12).toUpperCase();
      const bars = Array.from({ length: 40 }).map((_, i) => {
        const isWide = i === 0 || i === 1 || i === 39 || i === 38 || (i % 7 === 0) || (i % 11 === 0);
        const isSpace = i % 2 === 1;
        return `<div style="height:100%;width:${isSpace ? '0.5px' : isWide ? '2px' : '1px'};background:${isSpace ? 'transparent' : '#111'};"></div>`;
      }).join('');

      return `
        <div style="
          width:${widthVal}; height:${heightVal}; padding:${1.5 * scale}mm; box-sizing:border-box;
          background:#fff; color:#0f172a; overflow:hidden;
          page-break-after:always; page-break-inside:avoid;
          display:flex; flex-direction:column; justify-content:space-between;
          border:${2 * scale}px solid #0f172a;
          border-radius:${3 * scale}mm;
          font-family:'Arial',sans-serif;
        ">
          <!-- Shop Header (Deluxe styling) -->
          <div style="border-bottom: 1px solid #e2e8f0; padding-bottom: ${0.5 * scale}mm; display:flex; flex-direction:column; align-items:center; flex-shrink:0;">
            <div style="font-size:${7 * scale}px; font-weight:800; text-transform:uppercase; color:#0f172a; letter-spacing:${0.8 * scale}px; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%;">
              ⭐ ${shopDisplayName} ⭐
            </div>
            <div style="font-size:${4.5 * scale}px; color:#64748b; font-weight:500; letter-spacing:${0.2 * scale}px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%; text-align:center; margin-top:${0.2 * scale}mm;">
              ${shopAddr}
            </div>
          </div>

          <!-- Product Info & Price Row -->
          <div style="display:flex; align-items:center; justify-content:space-between; gap:${1.5 * scale}mm; margin: ${1 * scale}mm 0; flex-shrink:0;">
            <!-- Product Name -->
            <div style="flex:1; min-width:0; display:flex; flex-direction:column; justify-content:center;">
              <span style="font-size:${4.5 * scale}px; text-transform:uppercase; color:#64748b; font-weight:700; letter-spacing:${0.5 * scale}px; margin-bottom:${0.3 * scale}mm;">Mahsulot</span>
              <div style="font-size:${7.5 * scale}px; font-weight:800; color:#0f172a; line-height:1.2; word-break:break-all; max-height:${7.5 * scale}mm; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;">
                ${prod.name}
              </div>
            </div>
            
            <!-- Deluxe Price Badge -->
            <div style="background:#0f172a; color:#fff; border-radius:${1.5 * scale}mm; padding: ${1 * scale}mm ${1.8 * scale}mm; display:flex; flex-direction:column; align-items:center; justify-content:center; flex-shrink:0; border: 1px solid #10b981;">
              <span style="font-size:${3.5 * scale}px; font-weight:700; text-transform:uppercase; color:#10b981; letter-spacing:${0.5 * scale}px; margin-bottom:${0.2 * scale}mm;">Narxi</span>
              <div style="display:flex; align-items:baseline; gap:${0.3 * scale}mm;">
                <span style="font-size:${10.5 * scale}px; font-weight:900; color:#fff; letter-spacing:${-0.2 * scale}px;">${prod.sellingPrice.toLocaleString()}</span>
                <span style="font-size:${4.5 * scale}px; font-weight:700; color:#10b981;">sum</span>
              </div>
            </div>
          </div>

          <!-- Barcode (Crisp & Premium) -->
          <div style="display:flex; flex-direction:column; align-items:center; justify-content:flex-end; flex-shrink:0; padding-top:${0.5 * scale}mm;">
            <div style="display:flex; align-items:stretch; height:${5.2 * scale}mm; width:88%; justify-content:center; gap:0; opacity:0.95;">
              ${bars}
            </div>
            <div style="font-size:${5 * scale}px; font-family:'Courier New', monospace; font-weight:bold; letter-spacing:${0.6 * scale}px; color:#475569; margin-top:${0.4 * scale}mm; text-align:center;">
              *${barcode}*
            </div>
          </div>
        </div>
      `;
    }).join('');

    const win = window.open('', '_blank', 'width=500,height=700');
    if (!win) { alert("Brauzer popup blokirovkasi yoqilgan. Iltimos, popup'ga ruxsat bering."); return; }
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Etiketka — ${shopDisplayName}</title>
        <meta charset="utf-8">
        <style>
          * { margin:0; padding:0; box-sizing:border-box; }
          html, body { background:#f4f4f4; font-family:Arial,sans-serif; }
          .preview-wrapper { display:flex; flex-wrap:wrap; gap:4mm; padding:8mm; justify-content:flex-start; }
          @page { size: ${widthVal} ${heightVal}; margin:0; }
          @media print {
            html, body { background:#fff; }
            .preview-wrapper { display:block; padding:0; gap:0; }
          }
        </style>
      </head>
      <body>
        <div class="preview-wrapper">
          ${labelsHtml}
        </div>
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function(){ window.close(); }, 800);
          };
        <\/script>
      </body>
      </html>
    `);
    win.document.close();
  };

  const triggerLabelPrint = (prod) => {
    openLabelPrintWindow([prod]);
  };

  const triggerBulkLabelPrint = () => {
    const toPrint = filteredProducts.filter(p => selectedProductIds.has(p.id));
    if (toPrint.length === 0) return;
    openLabelPrintWindow(toPrint);
  };

  const toggleProductSelect = (id) => {
    setSelectedProductIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Bulk add actions
  const addBulkRow = () => {
    setBulkRows([...bulkRows, ...create10EmptyBulkRows()]);
  };

  const removeBulkRow = (index) => {
    if (bulkRows.length > 1) {
      setBulkRows(bulkRows.filter((_, i) => i !== index));
    }
  };

  const [isSearchingBarcode, setIsSearchingBarcode] = useState(false);

  const lookupBarcodeInfo = async (barcodeVal, isBulk = false, bulkIdx = null) => {
    if (!barcodeVal || barcodeVal.trim().length < 4) return;
    setIsSearchingBarcode(true);
    let found = false;
    try {
      const res = await fetch(`${API_URL}/products/lookup-barcode/${barcodeVal.trim()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.name) {
        if (isBulk && bulkIdx !== null) {
          setBulkRows(prev => {
            const updated = [...prev];
            updated[bulkIdx].name = data.name;
            return updated;
          });
        } else {
          setProductForm(prev => ({ ...prev, name: data.name }));
          if (data.originalName && data.source) {
            setBarcodeSourceInfo({ originalName: data.originalName, source: data.source });
          } else {
            setBarcodeSourceInfo(null);
          }
        }
        found = true;
      }
    } catch (err) {
      console.warn("Backend barcode lookup failed, falling back to frontend:", err);
    }

    // Frontend Fallback to Soliq Tasnif API directly
    if (!found) {
      try {
        const soliqResponse = await fetch(`https://tasnif.soliq.uz/api/cls-api/elasticsearch/search?search=${barcodeVal.trim()}&size=10&page=0&lang=uz`);
        if (soliqResponse.ok) {
          const soliqData = await soliqResponse.json();
          if (soliqData && Array.isArray(soliqData.data) && soliqData.data.length > 0) {
            const match = soliqData.data.find(item =>
              item.internationalCode === barcodeVal.trim() ||
              (item.fullName && item.fullName.includes(barcodeVal.trim()))
            );
            if (match && match.name) {
              const cleanName = (str) => {
                if (!str) return '';
                const parts = str.split(':');
                let cleaned = parts[parts.length - 1].trim();
                cleaned = cleaned.replace(/(coca-cola|pepsi|sprite|fanta)\s+\1/gi, '$1');
                cleaned = cleaned.replace(/(coca\s+cola)\s+\1/gi, '$1');
                cleaned = cleaned.replace(/(coca)\s+(coca-cola)/gi, '$2');
                cleaned = cleaned.replace(/(coca)\s+(coca\s+cola)/gi, '$2');
                cleaned = cleaned.replace(/\s+/g, ' ').trim();
                return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
              };
              const cleaned = cleanName(match.name);
              if (cleaned) {
                if (isBulk && bulkIdx !== null) {
                  setBulkRows(prev => {
                    const updated = [...prev];
                    updated[bulkIdx].name = cleaned;
                    return updated;
                  });
                } else {
                  setProductForm(prev => ({ ...prev, name: cleaned }));
                  setBarcodeSourceInfo({
                    originalName: match.name,
                    source: 'Soliq (Tasnif) ma\'lumotlar bazasi (Dinamik)'
                  });
                }
                found = true;
              }
            }
          }
        }
      } catch (soliqErr) {
        console.error("Frontend Soliq fallback lookup error:", soliqErr);
      }
    }

    if (!found && !isBulk) {
      setBarcodeSourceInfo(null);
    }
    setIsSearchingBarcode(false);
  };

  const handleSingleBarcodeChange = (e) => {
    const val = e.target.value;
    setProductForm(prev => ({ ...prev, barcode: val }));
    if (barcodeTimeoutRef.current) {
      clearTimeout(barcodeTimeoutRef.current);
    }
    const cleanVal = val.trim();
    if (cleanVal.length >= 4) {
      if (cleanVal.length === 8 || cleanVal.length === 12 || cleanVal.length === 13 || cleanVal.length === 14) {
        lookupBarcodeInfo(cleanVal, false);
      } else {
        barcodeTimeoutRef.current = setTimeout(() => {
          lookupBarcodeInfo(cleanVal, false);
        }, 400);
      }
    }
  };

  const handleSingleBarcodeKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (barcodeTimeoutRef.current) {
        clearTimeout(barcodeTimeoutRef.current);
      }
      lookupBarcodeInfo(productForm.barcode, false);
    }
  };

  const handleBulkBarcodeChange = (idx, val) => {
    updateBulkRow(idx, 'barcode', val);
    if (bulkBarcodeTimeoutRefs.current[idx]) {
      clearTimeout(bulkBarcodeTimeoutRefs.current[idx]);
    }
    const cleanVal = val.trim();
    if (cleanVal.length >= 4) {
      if (cleanVal.length === 8 || cleanVal.length === 12 || cleanVal.length === 13 || cleanVal.length === 14) {
        lookupBarcodeInfo(cleanVal, true, idx);
      } else {
        bulkBarcodeTimeoutRefs.current[idx] = setTimeout(() => {
          lookupBarcodeInfo(cleanVal, true, idx);
        }, 400);
      }
    }
  };

  const handleBulkBarcodeKeyDown = (idx, e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (bulkBarcodeTimeoutRefs.current[idx]) {
        clearTimeout(bulkBarcodeTimeoutRefs.current[idx]);
      }
      lookupBarcodeInfo(bulkRows[idx].barcode, true, idx);
    }
  };

  const updateBulkRow = (index, field, value) => {
    const updated = [...bulkRows];
    updated[index][field] = value;
    setBulkRows(updated);
  };

  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Filter out completely empty rows
    const validRows = bulkRows.filter(r => r.name.trim() !== '' && r.sellingPrice !== '');
    if (validRows.length === 0) {
      setError('Kamida bitta tovar nomi va sotuv narxini to\'ldiring');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/products/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ products: validRows })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Tovarlarni yuklashda xatolik yuz berdi');

      if (data.errors && data.errors.length > 0) {
        setError(`Qisman xatolik: ${data.errors.join(', ')}`);
        setTimeout(() => setError(''), 3000);
      }

      setSuccess(`${data.created} ta mahsulot muvaffaqiyatli qo'shildi!`);
      setShowBulkModal(false);
      setBulkRows(create10EmptyBulkRows());
      fetchProducts();
      fetchStats();
      setTimeout(() => setSuccess(''), 1500);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(''), 1500);
    }
  };

  // Filter Sales that are Qarz (CARD internally)
  // Filter and group Sales that are Qarz (CARD internally and unpaid)
  const groupedDebts = Object.values(
    sales
      .filter(s => s.paymentType === 'CARD' && !s.isDebtPaid)
      .reduce((acc, sale) => {
        const name = sale.customerName || 'Xaridor';
        // Remaining outstanding = totalAmount minus what's already been paid
        const remaining = sale.totalAmount - (sale.debtPaidAmount || 0);
        if (remaining <= 0) return acc; // Fully paid, skip
        if (!acc[name]) {
          acc[name] = {
            customerName: name,
            totalDebt: 0,
            salesCount: 0,
            lastSaleDate: sale.createdAt,
            cashierName: sale.cashier?.fullName || '—'
          };
        }
        acc[name].totalDebt += remaining;
        acc[name].salesCount += 1;
        if (new Date(sale.createdAt) > new Date(acc[name].lastSaleDate)) {
          acc[name].lastSaleDate = sale.createdAt;
        }
        return acc;
      }, {})
  );

  // Calculate total inventory value: sum of sellingPrice * stock for all products
  const totalInventoryValue = products.reduce((sum, p) => {
    return sum + (p.sellingPrice * p.stock);
  }, 0);

  const filteredProducts = products.filter(p => {
    const q = inventorySearch.toLowerCase().trim();
    if (!q) return true;
    return p.name.toLowerCase().includes(q) || (p.barcode && p.barcode.toLowerCase().includes(q));
  });

  if (loading) {
    return <div className="text-center py-12 text-slate-400">Statistika va ma'lumotlar yuklanmoqda...</div>;
  }

  // --- Chart.js Config ---
  const chartData = stats?.chartData || [];
  
  const revenueChartConfig = {
    labels: chartData.map(d => d.day),
    datasets: [
      {
        label: 'Tushum',
        data: chartData.map(d => d.revenue),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.3,
        fill: true,
      },
      {
        label: 'Sof foyda',
        data: chartData.map(d => d.profit),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.3,
        fill: true,
      }
    ]
  };

  const topProductsChartConfig = {
    labels: stats?.topProducts?.map(p => p.name) || [],
    datasets: [
      {
        label: 'Sotilgan soni',
        data: stats?.topProducts?.map(p => p.quantity) || [],
        backgroundColor: [
          '#10b981',
          '#3b82f6',
          '#f59e0b',
          '#ec4899',
          '#8b5cf6'
        ],
        borderWidth: 0,
      }
    ]
  };

  return (
    <div className="space-y-8 text-white min-h-[calc(100vh-80px)] pb-12">
      
      {/* Sub tabs navigation */}
      <div className="flex border-b border-slate-800 overflow-x-auto whitespace-nowrap flex-nowrap scrollbar-none pb-2 gap-1 no-print">
        <button
          onClick={() => setActiveTab('analytics')}
          className={`pb-4 px-6 font-bold text-sm transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
            activeTab === 'analytics' 
              ? 'border-emerald-500 text-emerald-400' 
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <TrendingUp size={16} />
          <span>Analitika</span>
        </button>
        <button
          onClick={() => setActiveTab('inventory')}
          className={`pb-4 px-6 font-bold text-sm transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
            activeTab === 'inventory' 
              ? 'border-emerald-500 text-emerald-400' 
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Package size={16} />
          <span>Mahsulotlar</span>
        </button>
        <button
          onClick={() => setActiveTab('sales')}
          className={`pb-4 px-6 font-bold text-sm transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
            activeTab === 'sales' 
              ? 'border-emerald-500 text-emerald-400' 
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <ShoppingBag size={16} />
          <span>Sotuvlar Tarixi</span>
        </button>
        <button
          onClick={() => setActiveTab('debts')}
          className={`pb-4 px-6 font-bold text-sm transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
            activeTab === 'debts' 
              ? 'border-emerald-500 text-emerald-400' 
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <FileText size={16} />
          <span>Qarzlar</span>
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`pb-4 px-6 font-bold text-sm transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
            activeTab === 'settings' 
              ? 'border-emerald-500 text-emerald-400' 
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Settings size={16} />
          <span>Sozlamalar</span>
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="bg-red-500/15 border border-red-500/30 p-4 rounded-2xl flex items-center gap-3 text-red-200 text-sm no-print animate-pulse">
          <AlertTriangle size={18} className="text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="bg-emerald-500/15 border border-emerald-500/30 p-4 rounded-2xl flex items-center gap-3 text-emerald-200 text-sm no-print">
          <Plus size={18} className="text-emerald-400 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* TAB 1: ANALYTICS */}
      {activeTab === 'analytics' && stats && (
        <div className="space-y-6 no-print">
          
          {/* Card summaries */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl backdrop-blur-md flex items-center gap-4">
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl">
                <DollarSign size={24} />
              </div>
              <div>
                <span className="text-xs text-slate-400 block uppercase font-semibold">Jami Tushum</span>
                <span className="text-xl font-bold mt-1 block">
                  {stats.summary.totalRevenue.toLocaleString()} UZS
                </span>
              </div>
            </div>

            <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl backdrop-blur-md flex items-center gap-4">
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-2xl">
                <TrendingUp size={24} />
              </div>
              <div>
                <span className="text-xs text-slate-400 block uppercase font-semibold">Sof Foyda</span>
                <span className="text-xl font-bold mt-1 block">
                  {stats.summary.netProfit.toLocaleString()} UZS
                </span>
              </div>
            </div>

            {/* This month's revenue */}
            <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl backdrop-blur-md flex items-center gap-4">
              <div className="p-4 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-2xl">
                <ShoppingBag size={24} />
              </div>
              <div>
                <span className="text-xs text-slate-400 block uppercase font-semibold">Joriy oy tushumi</span>
                <span className="text-xl font-bold mt-1 block">
                  {stats.monthlySummary.monthlyRevenue.toLocaleString()} UZS
                </span>
              </div>
            </div>

            {/* This month's profit */}
            <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl backdrop-blur-md flex items-center gap-4">
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl">
                <TrendingUp size={24} />
              </div>
              <div>
                <span className="text-xs text-slate-400 block uppercase font-semibold">Joriy oy sof foyda</span>
                <span className="text-xl font-bold mt-1 block text-emerald-400">
                  {stats.monthlySummary.monthlyNetProfit.toLocaleString()} UZS
                </span>
              </div>
            </div>
          </div>

          {/* Graphics section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-slate-900/40 border border-slate-800 p-6 rounded-3xl backdrop-blur-md">
              <h3 className="font-bold text-base mb-6 text-white">Oxirgi 7 kunlik sotuvlar va foyda</h3>
              <div className="h-80">
                <Line 
                  data={revenueChartConfig} 
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      y: { grid: { color: '#1e293b' }, ticks: { color: '#94a3b8' } },
                      x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                    },
                    plugins: { legend: { labels: { color: '#f3f4f6' } } }
                  }} 
                />
              </div>
            </div>

            <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl backdrop-blur-md flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-base mb-6 text-white">Top sotilgan tovarlar</h3>
                <div className="h-64 flex justify-center items-center">
                  {stats.topProducts.length === 0 ? (
                    <span className="text-slate-500 text-sm">Ma'lumotlar mavjud emas</span>
                  ) : (
                    <Doughnut 
                      data={topProductsChartConfig}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { position: 'bottom', labels: { color: '#f3f4f6' } } }
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Monthly Archives (Eski oylar arxivi) */}
          <div className="grid grid-cols-1 gap-6">
            <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl backdrop-blur-md space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <FolderArchive size={18} className="text-emerald-400" />
                  <span>Eski oylar arxivi (30 kundan oshgan hisobotlar)</span>
                </h3>
                {archiveSales.length > 0 && (
                  <button
                    onClick={() => { setShowArchiveClearModal(true); }}
                    className="px-4 py-2 bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-red-900/30 hover:border-red-800/40 rounded-xl text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5"
                  >
                    <Trash2 size={13} />
                    <span>Arxivni butunlay tozalash</span>
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {archiveSales.length === 0 ? (
                  <div className="text-center py-8 bg-slate-950/30 border border-slate-800/50 rounded-2xl">
                    <Archive size={28} className="mx-auto text-slate-600 mb-2 opacity-50" />
                    <p className="text-sm text-slate-500">Hozircha arxivlangan hisobotlar mavjud emas.</p>
                    <p className="text-[10px] text-slate-600 mt-1">30 kundan oshgan cheklar avtomatik ravishda shu yerga o'tadi.</p>
                  </div>
                ) : (
                  getGroupedArchiveSales().map(group => {
                    const isExpanded = expandedMonths.has(group.key);
                    return (
                      <div key={group.key} className="border border-slate-800 rounded-2xl bg-slate-950/20 overflow-hidden transition-all duration-300">
                        {/* Group Header */}
                        <div
                          onClick={() => {
                            setExpandedMonths(prev => {
                              const next = new Set(prev);
                              if (next.has(group.key)) next.delete(group.key); else next.add(group.key);
                              return next;
                            });
                          }}
                          className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-900/30 select-none transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-slate-200">{group.label}</span>
                            <span className="text-xs px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                              {group.sales.length} ta chek
                            </span>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <span className="text-xs text-slate-400 block">Jami savdo:</span>
                              <span className="text-sm font-bold text-emerald-400">{group.totalAmount.toLocaleString()} UZS</span>
                            </div>
                            {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                          </div>
                        </div>

                        {/* Group Body */}
                        {isExpanded && (
                          <div className="border-t border-slate-800/80 p-4 bg-slate-950/40 space-y-3 transition-all">
                            {/* Inner sales list */}
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                  <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                                    <th className="py-2.5 px-3">Chek №</th>
                                    <th className="py-2.5 px-3">Sana</th>
                                    <th className="py-2.5 px-3">Kassir</th>
                                    <th className="py-2.5 px-3">Mijoz</th>
                                    <th className="py-2.5 px-3 text-right">Chegir</th>
                                    <th className="py-2.5 px-3">Turi</th>
                                    <th className="py-2.5 px-3 text-right">Summa</th>
                                    <th className="py-2.5 px-3 text-center">Batafsil</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {group.sales.map(sale => (
                                    <tr key={sale.id} className="hover:bg-slate-900/30 border-b border-slate-800/40 transition-colors">
                                      <td className="py-2.5 px-3 font-medium text-slate-300">{sale.receiptNumber}</td>
                                      <td className="py-2.5 px-3 text-slate-400">{new Date(sale.createdAt).toLocaleString('uz-UZ').slice(0, 16)}</td>
                                      <td className="py-2.5 px-3 text-slate-400">{sale.cashier.fullName}</td>
                                      <td className="py-2.5 px-3 text-slate-400">{sale.customerName}</td>
                                      <td className="py-2.5 px-3 text-right text-amber-500 font-medium">-{sale.discountAmount.toLocaleString()} UZS</td>
                                      <td className="py-2.5 px-3">
                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                          sale.paymentType === 'CASH' 
                                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                            : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                        }`}>
                                          {sale.paymentType === 'CASH' ? 'NAQD' : 'KARTA'}
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-bold text-slate-200">{sale.totalAmount.toLocaleString()} UZS</td>
                                      <td className="py-2.5 px-3 text-center">
                                        <button
                                          onClick={() => { setSelectedSaleDetail(sale); }}
                                          className="text-emerald-500 hover:text-emerald-400 cursor-pointer font-bold"
                                        >
                                          Ko'rish
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: INVENTORY MANAGER */}
      {activeTab === 'inventory' && (
        <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl backdrop-blur-md space-y-6 no-print">
          <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-slate-800">
            <div className="flex-1 min-w-[280px]">
              <h3 className="font-bold text-lg text-white">Mahsulotlar ro'yxati</h3>
              {/* Inventory search bar */}
              <div className="relative mt-2 max-w-md">
                <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 pointer-events-none">
                  <Search size={14} />
                </span>
                <input
                  type="text"
                  placeholder="Mahsulot nomi yoki shtrix-kod bo'yicha qidirish..."
                  value={inventorySearch}
                  onChange={e => setInventorySearch(e.target.value)}
                  className="w-full pl-9 pr-9 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-xs transition-all"
                />
                {inventorySearch && (
                  <button 
                    onClick={() => setInventorySearch('')} 
                    className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setBulkRows(create10EmptyBulkRows()); setShowBulkModal(true); }}
                className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-2xl font-semibold flex items-center gap-2 cursor-pointer transition-colors text-xs"
              >
                <Table size={16} />
                <span>Jadval orqali tez qo'shish</span>
              </button>
              <button
                onClick={() => { resetProductForm(); setShowProductModal(true); }}
                className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-semibold shadow-lg shadow-emerald-600/20 flex items-center gap-2 cursor-pointer transition-colors text-xs"
              >
                <Plus size={16} />
                <span>Yangi mahsulot qo'shish</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            {/* Bulk label print bar */}
            {selectedProductIds.size > 0 && (
              <div className="mb-4 flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 px-5 py-3 rounded-2xl">
                <span className="text-emerald-400 font-semibold text-sm">
                  {selectedProductIds.size} ta mahsulot tanlandi
                </span>
                <button
                  onClick={triggerBulkLabelPrint}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold text-xs cursor-pointer transition-all shadow-lg shadow-emerald-600/20"
                >
                  <Printer size={14} />
                  Tanlanganlarga etiketka chiqarish
                </button>
                <button
                  onClick={() => setSelectedProductIds(new Set())}
                  className="ml-auto text-slate-400 hover:text-white text-xs cursor-pointer"
                >
                  Bekor qilish
                </button>
              </div>
            )}
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider font-semibold">
                  <th className="py-4 px-4 w-12">#</th>
                  <th className="py-4 px-4">Nomi</th>
                  <th className="py-4 px-4 hidden sm:table-cell">Shtrix-kod</th>
                  <th className="py-4 px-4 text-right hidden md:table-cell">Tannarx</th>
                  <th className="py-4 px-4 text-right">Sotuv Narxi</th>
                  <th className="py-4 px-4 text-right hidden md:table-cell">Foyda</th>
                  <th className="py-4 px-4 text-right hidden sm:table-cell">O'lchov</th>
                  <th className="py-4 px-4 text-center">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 text-sm">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center py-8 text-slate-500">Mahsulotlar topilmadi</td>
                  </tr>
                ) : (
                  filteredProducts.map((p, index) => {
                    const itemProfit = p.sellingPrice - p.costPrice;
                    const isSelected = selectedProductIds.has(p.id);
                    return (
                      <tr key={p.id} className={`transition-colors ${isSelected ? 'bg-emerald-500/5 border-l-2 border-l-emerald-500' : 'hover:bg-slate-950/20'}`}>
                        <td className="py-4 px-4">
                          <button
                            onClick={() => toggleProductSelect(p.id)}
                            title="Etiketka uchun tanlash"
                            className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center cursor-pointer transition-all font-bold text-xs ${
                              isSelected
                                ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                                : 'border-slate-700 text-slate-500 hover:border-emerald-500/50 hover:text-emerald-400'
                            }`}
                          >
                            {isSelected ? '✓' : index + 1}
                          </button>
                        </td>
                        <td className="py-4 px-4 font-semibold text-white">{p.name}</td>
                        <td className="py-4 px-4 font-mono text-slate-300 hidden sm:table-cell">{p.barcode || '-'}</td>
                        <td className="py-4 px-4 text-right text-slate-300 hidden md:table-cell">{p.costPrice.toLocaleString()} UZS</td>
                        <td className="py-4 px-4 text-right text-emerald-400 font-bold">{p.sellingPrice.toLocaleString()} UZS</td>
                        <td className="py-4 px-4 text-right text-emerald-500 font-medium hidden md:table-cell">+{itemProfit.toLocaleString()} UZS</td>
                        <td className="py-4 px-4 text-right capitalize text-slate-300 hidden sm:table-cell">{p.unit}</td>
                        <td className="py-4 px-4">
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={() => triggerLabelPrint(p)}
                              className="p-2 text-slate-400 hover:text-emerald-400 bg-slate-900 border border-slate-800 rounded-xl cursor-pointer flex items-center gap-1 text-xs"
                              title="40mm x 30mm etiketka chiqarish"
                            >
                              <Printer size={14} />
                              <span>Etiketka</span>
                            </button>
                            <button
                              onClick={() => openEditProduct(p)}
                              className="p-2 text-slate-400 hover:text-emerald-400 bg-slate-900 border border-slate-800 rounded-xl cursor-pointer"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => deleteProduct(p.id)}
                              className="p-2 text-slate-400 hover:text-red-400 bg-slate-900 border border-slate-800 rounded-xl cursor-pointer"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: SALES HISTORY (SOTUVLAR TARIXI) */}
      {activeTab === 'sales' && (
        <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl backdrop-blur-md space-y-6 no-print">
          <div>
            <h3 className="font-bold text-lg text-white">Sotuvlar tarixi</h3>
            <p className="text-xs text-slate-400">Do'konda amalga oshirilgan barcha savdo cheklari ro'yxati</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider font-semibold">
                  <th className="py-4 px-4 hidden sm:table-cell">Sana</th>
                  <th className="py-4 px-4">Chek raqami</th>
                  <th className="py-4 px-4 hidden md:table-cell">Sotuvchi</th>
                  <th className="py-4 px-4">Xaridor</th>
                  <th className="py-4 px-4">To'lov turi</th>
                  <th className="py-4 px-4 text-right">Summa UZS</th>
                  <th className="py-4 px-4 text-center">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 text-sm">
                {sales.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-8 text-slate-500">Sotuvlar tarixi bo'sh</td>
                  </tr>
                ) : (
                  sales.map(s => (
                    <tr key={s.id} className="hover:bg-slate-950/20 transition-colors">
                      <td className="py-4 px-4 text-slate-450 hidden sm:table-cell">{new Date(s.createdAt).toLocaleString('uz-UZ')}</td>
                      <td className="py-4 px-4 font-mono font-semibold text-white">{s.receiptNumber}</td>
                      <td className="py-4 px-4 text-slate-300 hidden md:table-cell">{s.cashier?.fullName}</td>
                      <td className="py-4 px-4 text-slate-350">{s.customerName}</td>
                      <td className="py-4 px-4 text-xs font-semibold capitalize">
                        <span className={`px-2 py-0.5 rounded-full ${
                          s.paymentType === 'CASH' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                          s.paymentType === 'CARD' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                          'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        }`}>
                          {s.paymentType === 'CASH' ? 'Naqd' : s.paymentType === 'CARD' ? 'Qarz' : 'Click/Payme'}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right text-white font-bold">{s.totalAmount.toLocaleString()} UZS</td>
                      <td className="py-4 px-4">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => viewSaleDetails(s.id)}
                            className="p-2 text-slate-400 hover:text-emerald-450 bg-slate-900 border border-slate-800 rounded-xl cursor-pointer"
                            title="Tafsilotlar"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={() => deleteSaleRecord(s.id)}
                            className="p-2 text-slate-400 hover:text-red-400 bg-slate-900 border border-slate-800 rounded-xl cursor-pointer"
                            title="Sotuvni bekor qilish / O'chirish"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: DEBTS (QARZLAR) */}
      {activeTab === 'debts' && (
        <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl backdrop-blur-md space-y-6 no-print">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-lg text-white">Qarzlar ro'yxati</h3>
              <p className="text-xs text-slate-400">Do'kondan qarzga olingan xaridlar tarixi va ularni yopish</p>
            </div>
            {groupedDebts.length > 0 && (
              <div className="text-right">
                <div className="text-xs text-slate-400">Jami qarz</div>
                <div className="text-xl font-extrabold text-red-400">
                  {groupedDebts.reduce((s, d) => s + d.totalDebt, 0).toLocaleString()} UZS
                </div>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider font-semibold">
                  <th className="py-4 px-4 w-10">#</th>
                  <th className="py-4 px-4">Xaridor</th>
                  <th className="py-4 px-4 text-center hidden sm:table-cell">Xaridlar</th>
                  <th className="py-4 px-4 hidden sm:table-cell">Oxirgi xarid</th>
                  <th className="py-4 px-4 text-right">Qolgan qarz</th>
                  <th className="py-4 px-4 text-center" style={{minWidth: '240px'}}>To'lov</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 text-sm">
                {groupedDebts.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-12 text-slate-500">
                      <div className="text-4xl mb-2">✅</div>
                      Hozircha qarzlar mavjud emas
                    </td>
                  </tr>
                ) : (
                  groupedDebts.map((d, index) => {
                    const payInput = debtPayInputs[d.customerName] || '';
                    return (
                      <tr key={d.customerName} className="hover:bg-slate-950/20 transition-colors">
                        <td className="py-4 px-4 text-slate-500 font-bold">{index + 1}</td>
                        <td className="py-4 px-4">
                          <div className="font-semibold text-white capitalize">{d.customerName}</div>
                          <div className="text-xs text-slate-500">{d.cashierName}</div>
                        </td>
                        <td className="py-4 px-4 text-center text-slate-300 font-bold hidden sm:table-cell">{d.salesCount} ta</td>
                        <td className="py-4 px-4 text-slate-400 text-xs hidden sm:table-cell">
                          {new Date(d.lastSaleDate).toLocaleString('uz-UZ')}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <span className="text-red-400 font-extrabold text-base">
                            {d.totalDebt.toLocaleString()}
                          </span>
                          <span className="text-slate-500 text-xs ml-1">UZS</span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            {/* Partial payment input */}
                            <div className="relative flex-1">
                              <input
                                type="number"
                                min="0"
                                max={d.totalDebt}
                                step="100"
                                placeholder={`Maks: ${d.totalDebt.toLocaleString()}`}
                                value={payInput}
                                onChange={e => setDebtPayInputs(prev => ({ ...prev, [d.customerName]: e.target.value }))}
                                onKeyDown={e => {
                                  if (e.key === 'Enter' && payInput) {
                                    handleClearCustomerDebt(d.customerName, payInput);
                                  }
                                }}
                                className="w-full pl-3 pr-10 py-2 bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl text-white text-xs focus:outline-none"
                              />
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-[9px] pointer-events-none">UZS</span>
                            </div>
                            {/* Partial pay button */}
                            <button
                              disabled={!payInput || parseFloat(payInput) <= 0}
                              onClick={() => handleClearCustomerDebt(d.customerName, payInput)}
                              className="px-3 py-2 bg-amber-600/20 border border-amber-500/30 text-amber-400 hover:bg-amber-600 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed rounded-xl transition-all cursor-pointer text-xs font-semibold whitespace-nowrap"
                              title="Kiritilgan summani to'lash"
                            >
                              To'lash
                            </button>
                            {/* Full clear button */}
                            <button
                              onClick={() => handleClearCustomerDebt(d.customerName)}
                              className="px-3 py-2 bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-600 hover:text-white rounded-xl transition-all cursor-pointer text-xs font-semibold whitespace-nowrap"
                              title="Barcha qarzni to'liq yopish"
                            >
                              Hammasi
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: SETTINGS (SOZLAMALAR) */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 no-print">
          
          {/* Shop settings */}
          <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl backdrop-blur-md space-y-6">
            <h3 className="font-bold text-lg text-white flex items-center gap-2">
              <Settings size={20} className="text-emerald-400" />
              <span>Do'kon va Chek sozlamalari</span>
            </h3>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Existing fields */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Do'kon nomi</label>
                <input
                  type="text"
                  value={shopName}
                  onChange={e => setShopName(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-md text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Manzil</label>
                <input
                  type="text"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-md text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Telefon</label>
                <input
                  type="text"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-md text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Sotuvdan keyin chek chiqarish</label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={printReceipt}
                    onChange={e => setPrintReceipt(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 peer-checked:after:bg-white"></div>
                  <span className="ml-3 text-sm font-semibold text-slate-300">{printReceipt ? "Faol" : "Faol emas"}</span>
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Chek o'lchami (Kengligi)</label>
                <select
                  value={receiptWidth}
                  onChange={e => setReceiptWidth(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-md text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="80mm">80 mm (Standart)</option>
                  <option value="58mm">58 mm</option>
                  <option value="56mm">56 mm</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Yorliq (Etiketka) o'lchami</label>
                <select
                  value={labelSize}
                  onChange={e => setLabelSize(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-md text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="40x30mm">40 x 30 mm (Standart)</option>
                  <option value="30x20mm">30 x 20 mm</option>
                  <option value="43x25mm">43 x 25 mm</option>
                  <option value="58x40mm">58 x 40 mm</option>
                </select>
              </div>
              {/* New Telegram fields */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Telegram Bot Token</label>
                <input
                  type="text"
                  value={tgBotToken}
                  onChange={e => setTgBotToken(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-md text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Telegram Chat ID</label>
                <input
                  type="text"
                  value={tgChatId}
                  onChange={e => setTgChatId(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-md text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
            <button
              type="submit"
              className="mt-4 w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md"
            >
              Saqlash
            </button>
            </form>
          </div>

          {/* Password settings */}
          <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl backdrop-blur-md space-y-6">
            <h3 className="font-bold text-lg text-white flex items-center gap-2">
              <Lock size={20} className="text-blue-400" />
              <span>Xavfsizlik (Parolni yangilash)</span>
            </h3>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 font-semibold mb-2">Eski parol</label>
                <div className="relative">
                  <input
                    type={showOldPw ? 'text' : 'password'}
                    required
                    value={oldPassword}
                    onChange={e => setOldPassword(e.target.value)}
                    className="w-full px-4 pr-12 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowOldPw(v => !v)} className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-white cursor-pointer" tabIndex={-1}>
                    {showOldPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 font-semibold mb-2">Yangi parol</label>
                <div className="relative">
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full px-4 pr-12 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowNewPw(v => !v)} className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-white cursor-pointer" tabIndex={-1}>
                    {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all cursor-pointer shadow-md"
              >
                Parolni o'zgartirish
              </button>
            </form>
          </div>

          {/* PIN Code Setup */}
          <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl backdrop-blur-md space-y-5">
            <h3 className="font-bold text-lg text-white flex items-center gap-2">
              <Lock size={20} className="text-amber-400" />
              <span>PIN kod (Ekran qulflash)</span>
            </h3>
            {currentPin && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl text-emerald-400 text-sm flex items-center justify-between gap-3">
                <span>✅ PIN kod o'rnatilgan</span>
                <button
                  onClick={async () => {
                    if (pinKey) {
                      try {
                        const res = await fetch(`${API_URL}/auth/update-pin`, {
                          method: 'PUT',
                          headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`
                          },
                          body: JSON.stringify({ pinCode: "" })
                        });
                        if (res.ok) {
                          localStorage.removeItem(pinKey);
                          setSuccess('PIN kod o\'chirildi!');
                        } else {
                          setError('PIN kodni o\'chirishda xatolik yuz berdi');
                        }
                      } catch (err) {
                        console.error(err);
                        setError('Server bilan bog\'lanishda xatolik');
                      }
                      setTimeout(() => { setSuccess(''); setError(''); }, 1500);
                    }
                  }}
                  className="text-xs text-red-400 hover:text-red-300 cursor-pointer border border-red-500/20 px-2 py-1 rounded-lg"
                >
                  O'chirish
                </button>
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 font-semibold mb-2">4 xonali PIN kod</label>
                <input
                  type="password"
                  maxLength={4}
                  inputMode="numeric"
                  value={pinInput}
                  onChange={e => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500 text-center text-2xl font-bold tracking-[1.5rem]"
                  placeholder="••••"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 font-semibold mb-2">PIN kodni tasdiqlang</label>
                <input
                  type="password"
                  maxLength={4}
                  inputMode="numeric"
                  value={pinConfirm}
                  onChange={e => setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500 text-center text-2xl font-bold tracking-[1.5rem]"
                  placeholder="••••"
                />
              </div>
              <button
                type="button"
                onClick={async () => {
                  if (!pinKey) { setError('Foydalanuvchi ID topilmadi'); return; }
                  if (pinInput.length !== 4 || !/^\d{4}$/.test(pinInput)) { setError('PIN kod 4 ta raqamdan iborat bo\'lishi kerak'); setTimeout(() => setError(''), 1500); return; }
                  if (pinInput !== pinConfirm) { setError('PIN kodlar mos kelmaydi'); setTimeout(() => setError(''), 1500); return; }
                  try {
                    const res = await fetch(`${API_URL}/auth/update-pin`, {
                      method: 'PUT',
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                      },
                      body: JSON.stringify({ pinCode: pinInput })
                    });
                    if (res.ok) {
                      localStorage.setItem(pinKey, pinInput);
                      setSuccess('PIN kod o\'rnatildi! 1 soat faoliyatsizlikdan keyin avtomatik qulflanadi.');
                    } else {
                      setError('PIN kodni saqlashda xatolik yuz berdi');
                    }
                  } catch (err) {
                    console.error(err);
                    setError('Server bilan bog\'lanishda xatolik');
                  }
                  setPinInput(''); setPinConfirm('');
                  setTimeout(() => { setSuccess(''); setError(''); }, 2000);
                }}
                className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-xl transition-all cursor-pointer"
              >
                PIN kodni saqlash
              </button>
              <p className="text-xs text-slate-500 text-center">1 soat foydalanilmasa ekran avtomatik qulflanadi</p>
            </div>
          </div>

        </div>
      )}

      {/* --- MODALS SECTION --- */}

      {/* 1. PRODUCT ENTRY MODAL */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 no-print">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl p-6 relative shadow-2xl">
            <button 
              onClick={() => setShowProductModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-2"
            >
              <X size={20} />
            </button>
            <h3 className="font-bold text-lg text-white mb-6">
              {productForm.id ? 'Mahsulotni tahrirlash' : 'Yangi mahsulot qo\'shish'}
            </h3>

            <form onSubmit={handleProductSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs text-slate-400 font-semibold mb-2">Shtrix-kod</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={productForm.barcode}
                      onChange={handleSingleBarcodeChange}
                      onKeyDown={handleSingleBarcodeKeyDown}
                      onBlur={() => lookupBarcodeInfo(productForm.barcode, false)}
                      className="w-full pl-4 pr-10 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                      placeholder="Shtrix-kod (skanerlang yoki yozib Enter bosing)"
                      autoFocus
                    />
                    {isSearchingBarcode && (
                      <div className="absolute right-3 top-3.5 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-emerald-500 border-t-transparent"></div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs text-slate-400 font-semibold mb-2">Mahsulot nomi *</label>
                  <input
                    type="text"
                    required
                    value={productForm.name}
                    onChange={e => setProductForm({...productForm, name: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                    placeholder="Masalan: Coca Cola 1.5L"
                  />
                  {barcodeSourceInfo && (
                    <div className="mt-2.5 bg-slate-950/65 border border-slate-800/80 p-3.5 rounded-xl space-y-1.5 text-xs animate-fadeIn">
                      <div className="text-slate-400 font-bold flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-500 inline-block animate-ping" />
                          Tizim Qidiruv Manbasi: <span className="text-purple-400">{barcodeSourceInfo.source}</span>
                        </span>
                      </div>
                      <div className="text-slate-350 font-mono break-words leading-relaxed border-t border-slate-900 pt-1.5">
                        <span className="text-slate-500">Asl nomi:</span> {barcodeSourceInfo.originalName}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs text-slate-400 font-semibold mb-2">Tannarxi (Cost Price) *</label>
                  <input
                    type="number"
                    required
                    value={productForm.costPrice}
                    onChange={e => setProductForm({...productForm, costPrice: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                    placeholder="0 UZS"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 font-semibold mb-2">Sotuv narxi *</label>
                  <input
                    type="number"
                    required
                    value={productForm.sellingPrice}
                    onChange={e => setProductForm({...productForm, sellingPrice: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                    placeholder="0 UZS"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs text-slate-400 font-semibold mb-2">O'lchov birligi *</label>
                  <select
                    value={productForm.unit}
                    onChange={e => setProductForm({...productForm, unit: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="dona">Dona (pcs)</option>
                    <option value="kg">Kilogramm (kg)</option>
                    <option value="metr">Metr (m)</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-4 pt-4 border-t border-slate-800 mt-6">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="flex-1 py-3 bg-slate-850 hover:bg-slate-800 rounded-xl text-slate-300 font-semibold transition-colors cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold transition-colors cursor-pointer"
                >
                  Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. BULK PRODUCTS ROW ENTRY MODAL */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 no-print">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl p-6 relative shadow-2xl flex flex-col max-h-[90vh]">
            <button 
              onClick={() => setShowBulkModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 cursor-pointer"
            >
              <X size={20} />
            </button>
            <h3 className="font-bold text-lg text-white mb-2 flex items-center gap-2">
              <Table className="text-emerald-400" size={20} />
              <span>Mahsulotlarni jadval orqali tez qo'shish</span>
            </h3>
            <p className="text-xs text-slate-400 mb-6">Mahsulotlarni qatorlar bo'yicha to'ldiring va saqlang</p>

            <div className="flex-1 overflow-y-auto mb-6 border border-slate-800 rounded-2xl bg-slate-950/45">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-950 z-10">
                  <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                    <th className="py-3 px-3">Shtrix-kod</th>
                    <th className="py-3 px-3">Nomi *</th>
                    <th className="py-3 px-3 w-32">Tannarx (UZS)</th>
                    <th className="py-3 px-3 w-32">Sotish narxi * (UZS)</th>
                    <th className="py-3 px-3 w-28">O'lchov</th>
                    <th className="py-3 px-3 text-center w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {bulkRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/40">
                      <td className="p-2">
                        <input
                          type="text"
                          value={row.barcode}
                          onChange={(e) => handleBulkBarcodeChange(idx, e.target.value)}
                          onKeyDown={(e) => handleBulkBarcodeKeyDown(idx, e)}
                          className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                          placeholder="Barkod"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          required
                          value={row.name}
                          onChange={(e) => updateBulkRow(idx, 'name', e.target.value)}
                          className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                          placeholder="Coca Cola 1.5L"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          value={row.costPrice}
                          onChange={(e) => updateBulkRow(idx, 'costPrice', e.target.value)}
                          className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                          placeholder="0 UZS"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          required
                          value={row.sellingPrice}
                          onChange={(e) => updateBulkRow(idx, 'sellingPrice', e.target.value)}
                          className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                          placeholder="0 UZS"
                        />
                      </td>
                      <td className="p-2">
                        <select
                          value={row.unit}
                          onChange={(e) => updateBulkRow(idx, 'unit', e.target.value)}
                          className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                        >
                          <option value="dona">Dona</option>
                          <option value="kg">Kg</option>
                          <option value="metr">Metr</option>
                        </select>
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeBulkRow(idx)}
                          disabled={bulkRows.length <= 1}
                          className="p-1.5 text-slate-500 hover:text-red-400 disabled:opacity-30 transition-colors cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-4 pt-4 border-t border-slate-800 mt-auto shrink-0 justify-between items-center">
              <button
                type="button"
                onClick={addBulkRow}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Plus size={14} />
                <span>Qator qo'shish</span>
              </button>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="button"
                  onClick={handleBulkSubmit}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-lg shadow-emerald-600/20"
                >
                  Barchasini saqlash
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. SALE DETAILS MODAL */}
      {selectedSaleDetail && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 no-print">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl p-6 relative shadow-2xl">
            <button 
              onClick={() => setSelectedSaleDetail(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 cursor-pointer"
            >
              <X size={20} />
            </button>
            
            <h3 className="font-bold text-lg text-white mb-2">Chek tafsilotlari</h3>
            <p className="text-xs text-slate-400 mb-6">Chek raqami: #{selectedSaleDetail.receiptNumber}</p>

            <div className="grid grid-cols-2 gap-4 mb-6 bg-slate-950/40 border border-slate-855 p-4 rounded-2xl text-sm">
              <div>
                <span className="text-slate-400 block text-xs">Sana:</span>
                <span className="text-white font-medium">{new Date(selectedSaleDetail.createdAt).toLocaleString('uz-UZ')}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-xs">Sotuvchi:</span>
                <span className="text-white font-medium">{selectedSaleDetail.cashier?.fullName}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-xs">Xaridor:</span>
                <span className="text-white font-medium capitalize">{selectedSaleDetail.customerName}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-xs">To'lov turi:</span>
                <span className="text-emerald-400 font-semibold">
                  {selectedSaleDetail.paymentType === 'CASH' ? 'Naqd' : selectedSaleDetail.paymentType === 'CARD' ? 'Qarz' : 'Click/Payme'}
                </span>
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto mb-6">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-850 text-slate-455 pb-2">
                    <th className="pb-2">Mahsulot nomi</th>
                    <th className="pb-2 text-right">Miqdor</th>
                    <th className="pb-2 text-right">Sotish narxi</th>
                    <th className="pb-2 text-right">Jami</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/60">
                  {selectedSaleDetail.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2.5 font-medium text-white">{item.product.name}</td>
                      <td className="py-2.5 text-right text-slate-300">{item.quantity} {item.product.unit}</td>
                      <td className="py-2.5 text-right text-slate-300">{item.sellingPrice.toLocaleString()} UZS</td>
                      <td className="py-2.5 text-right text-emerald-400 font-bold">{(item.sellingPrice * item.quantity).toLocaleString()} UZS</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center border-t border-slate-800 pt-4">
              <div className="text-sm font-bold text-white">
                Jami: <span className="text-emerald-400 text-base">{selectedSaleDetail.totalAmount.toLocaleString()} UZS</span>
              </div>
              <button
                onClick={() => setSelectedSaleDetail(null)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-750 text-white rounded-xl font-medium cursor-pointer transition-colors"
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 4. ARCHIVE CLEAR MODAL */}
      {showArchiveClearModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 no-print">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 relative shadow-2xl space-y-4">
            <button 
              onClick={() => { setShowArchiveClearModal(false); setArchiveClearPassword(''); }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 cursor-pointer"
            >
              <X size={20} />
            </button>
            
            <h3 className="font-bold text-lg text-white flex items-center gap-2">
              <Trash2 className="text-red-500" size={20} />
              <span>Arxivni tozalashni tasdiqlang</span>
            </h3>
            
            <p className="text-xs text-slate-400">
              30 kundan oshgan barcha arxivlangan cheklar butunlay o'chib ketadi! Ushbu amalni bekor qilib bo'lmaydi.
            </p>

            <form onSubmit={handleClearArchive} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs text-slate-400 font-semibold mb-2">Shaxsiy parolingizni kiriting *</label>
                <input
                  type="password"
                  required
                  value={archiveClearPassword}
                  onChange={e => setArchiveClearPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-red-500 text-sm"
                  placeholder="Parolingizni kiriting"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowArchiveClearModal(false); setArchiveClearPassword(''); }}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors shadow-lg shadow-red-600/20"
                >
                  Tasdiqlayman (O'chirish)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

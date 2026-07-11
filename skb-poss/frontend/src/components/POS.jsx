import React, { useState, useEffect, useRef } from 'react';
import { API_URL } from '../config.js';
import { 
  Search, ShoppingCart, Wallet, Smartphone, Trash2, 
  Plus, Minus, RefreshCw, Barcode, AlertTriangle, Printer, HandCoins
} from 'lucide-react';

export default function POS({ token, user, onTriggerPrint }) {
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [paymentType, setPaymentType] = useState('CASH');
  const [customerName, setCustomerName] = useState('');
  const [showDebtorSuggestions, setShowDebtorSuggestions] = useState(false);
  const [debtors, setDebtors] = useState([]);  // Existing debtors list
  
  // Barcode scanner input
  const [barcodeInput, setBarcodeInput] = useState('');
  const barcodeInputRef = useRef(null);
  const customerNameRef = useRef(null);

  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [tempRowInputs, setTempRowInputs] = useState({});

  useEffect(() => {
    fetchProducts();
    fetchDebtors();
    
    if (barcodeInputRef.current) barcodeInputRef.current.focus();

    // Only move focus to barcode when clicking blank areas — not on any interactive element
    const handleGlobalClick = (e) => {
      const tag = e.target.tagName.toLowerCase();
      const isInteractive = ['input', 'textarea', 'select', 'button', 'label', 'a'].includes(tag);
      const isInsideInteractive = e.target.closest('input, textarea, select, button, [role="button"]');
      if (isInteractive || isInsideInteractive) return;
      if (barcodeInputRef.current) barcodeInputRef.current.focus();
    };
    document.addEventListener('click', handleGlobalClick);

    // Global barcode gun listener
    let barcodeBuffer = '';
    let lastKeyTime = Date.now();
    const handleKeyDown = (e) => {
      if (
        document.activeElement?.id === 'searchQueryInput' ||
        document.activeElement?.id === 'customerNameInput' ||
        document.activeElement?.id === 'discountInput' ||
        document.activeElement?.tagName?.toLowerCase() === 'input'
      ) return;
      const currentTime = Date.now();
      if (currentTime - lastKeyTime > 100) barcodeBuffer = '';
      lastKeyTime = currentTime;
      if (e.key === 'Enter') {
        if (barcodeBuffer.length > 2) { handleBarcodeScan(barcodeBuffer); barcodeBuffer = ''; }
      } else if (e.key.length === 1) {
        barcodeBuffer += e.key;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('click', handleGlobalClick);
    };
  }, []);

  // Refetch debtors whenever payment type changes to CARD
  useEffect(() => {
    if (paymentType === 'CARD') fetchDebtors();
  }, [paymentType]);

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API_URL}/products`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) setProducts(data);
    } catch (err) { console.error(err); }
  };

  const fetchDebtors = async () => {
    try {
      const res = await fetch(`${API_URL}/sales`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) {
        // Extract unique debtor names from CARD sales (exclude 'Xaridor')
        const debtSales = data.filter(s => s.paymentType === 'CARD' && s.customerName !== 'Xaridor');
        const uniqueDebtors = [...new Set(debtSales.map(s => s.customerName))];
        setDebtors(uniqueDebtors);
      }
    } catch (err) { console.error(err); }
  };

  const handleBarcodeScan = (code) => {
    const cleanedCode = code.trim();
    const product = products.find(p => p.barcode === cleanedCode);
    if (product) {
      addToCart(product);
      setSuccessMsg(`Skanerlandi: ${product.name}`);
      setTimeout(() => setSuccessMsg(''), 1500);
    } else {
      setError(`Shtrix-kod topilmadi: ${cleanedCode}`);
      setTimeout(() => setError(''), 1500);
    }
  };

  const handleScannerSubmit = (e) => {
    e.preventDefault();
    if (barcodeInput.trim()) { handleBarcodeScan(barcodeInput); setBarcodeInput(''); }
  };

  const addToCart = (product) => {
    if (product.stock <= 0) {
      setError(`"${product.name}" mahsulotidan omborda qolmagan!`);
      setTimeout(() => setError(''), 1500);
      return;
    }
    setCart(prevCart => {
      const existing = prevCart.find(item => item.productId === product.id);
      if (existing) {
        const newQty = parseFloat((existing.quantity + 1).toFixed(3));
        if (newQty > product.stock) {
          setError(`Omborda faqat ${product.stock} ta "${product.name}" bor!`);
          setTimeout(() => setError(''), 1500);
          return prevCart;
        }
        return prevCart.map(item =>
          item.productId === product.id ? { ...item, quantity: newQty } : item
        );
      }
      return [...prevCart, {
        productId: product.id,
        name: product.name,
        sellingPrice: product.sellingPrice,
        originalSellingPrice: product.sellingPrice,
        unit: product.unit,
        quantity: 1,
        maxStock: product.stock
      }];
    });
  };

  const updateCartQty = (productId, step) => {
    setCart(prevCart => prevCart.map(item => {
      if (item.productId !== productId) return item;
      const newQty = parseFloat((item.quantity + step).toFixed(3));
      if (newQty <= 0) return null;
      if (newQty > item.maxStock) {
        setError(`Omborda faqat ${item.maxStock} ta bor!`);
        setTimeout(() => setError(''), 1500);
        return item;
      }
      const newPrice = parseFloat((newQty * item.originalSellingPrice).toFixed(2));
      return { ...item, quantity: newQty, sellingPrice: newPrice };
    }).filter(Boolean));
  };

  const setCartQty = (productId, rawValue, maxStock) => {
    // Allow intermediate values like "0.", "0.3" etc. Don't parse until user finishes typing
    // Just store the raw string and update on blur
    const str = rawValue;
    // If empty, don't change anything
    if (str === '' || str === '0.') {
      setCart(prev => prev.map(item =>
        item.productId === productId ? { ...item, _qtyInput: str } : item
      ));
      return;
    }
    const newQty = parseFloat(str);
    if (isNaN(newQty) || newQty < 0) return;
    if (newQty === 0) { removeFromCart(productId); return; }
    if (newQty > maxStock) {
      setError(`Omborda faqat ${maxStock} ta bor!`);
      setTimeout(() => setError(''), 1500);
      return;
    }
    setCart(prev => prev.map(item => {
      if (item.productId !== productId) return item;
      const parsedQty = parseFloat(newQty.toFixed(3));
      const newPrice = parseFloat((parsedQty * item.originalSellingPrice).toFixed(2));
      return { ...item, quantity: parsedQty, sellingPrice: newPrice, _qtyInput: str };
    }));
  };

  const commitCartQty = (productId, rawValue, maxStock) => {
    // On blur, commit the final value
    const newQty = parseFloat(rawValue);
    if (isNaN(newQty) || newQty <= 0) { removeFromCart(productId); return; }
    if (newQty > maxStock) {
      setError(`Omborda faqat ${maxStock} ta bor!`);
      setTimeout(() => setError(''), 1500);
      return;
    }
    setCart(prev => prev.map(item => {
      if (item.productId !== productId) return item;
      const parsedQty = parseFloat(newQty.toFixed(3));
      const newPrice = parseFloat((parsedQty * item.originalSellingPrice).toFixed(2));
      return { ...item, quantity: parsedQty, sellingPrice: newPrice, _qtyInput: undefined };
    }));
  };

  const getRowData = (productId, originalSellingPrice) => {
    const cartItem = cart.find(c => c.productId === productId);
    if (cartItem) {
      return {
        quantity: cartItem._qtyInput !== undefined ? cartItem._qtyInput : cartItem.quantity,
        sellingPrice: cartItem.sellingPrice,
        inCart: true
      };
    }
    const temp = tempRowInputs[productId] || { quantity: '1', sellingPrice: originalSellingPrice.toString() };
    return {
      quantity: temp.quantity,
      sellingPrice: temp.sellingPrice,
      inCart: false
    };
  };

  const handleRowQtyChange = (productId, rawValue, maxStock, originalSellingPrice) => {
    const cartItem = cart.find(c => c.productId === productId);
    if (cartItem) {
      setCartQty(productId, rawValue, maxStock);
    } else {
      const qtyVal = parseFloat(rawValue) || 0;
      const calculatedPrice = parseFloat((qtyVal * originalSellingPrice).toFixed(2));
      setTempRowInputs(prev => ({
        ...prev,
        [productId]: {
          quantity: rawValue,
          sellingPrice: rawValue === '' || rawValue === '0.' ? '' : calculatedPrice.toString()
        }
      }));
    }
  };

  const handleRowPriceChange = (productId, rawPrice, originalSellingPrice) => {
    const cartItem = cart.find(c => c.productId === productId);
    if (cartItem) {
      setItemCustomPrice(productId, rawPrice, originalSellingPrice);
    } else {
      const priceVal = parseFloat(rawPrice) || 0;
      const calculatedQty = parseFloat((priceVal / originalSellingPrice).toFixed(3));
      setTempRowInputs(prev => ({
        ...prev,
        [productId]: {
          quantity: isNaN(calculatedQty) || calculatedQty <= 0 ? '0' : calculatedQty.toString(),
          sellingPrice: rawPrice
        }
      }));
    }
  };

  const handleRowAddOrUpdate = (product) => {
    const rowData = getRowData(product.id, product.sellingPrice);
    const qty = parseFloat(rowData.quantity);
    const price = parseFloat(rowData.sellingPrice);

    if (isNaN(qty) || qty <= 0) {
      setError("Noto'g'ri miqdor kiritildi!");
      setTimeout(() => setError(''), 1500);
      return;
    }
    if (qty > product.stock) {
      setError(`Omborda faqat ${product.stock} ta bor!`);
      setTimeout(() => setError(''), 1500);
      return;
    }

    setCart(prev => {
      const exists = prev.find(item => item.productId === product.id);
      if (exists) {
        return prev.map(item =>
          item.productId === product.id
            ? { ...item, quantity: qty, sellingPrice: price, _qtyInput: undefined }
            : item
        );
      } else {
        return [
          ...prev,
          {
            productId: product.id,
            name: product.name,
            barcode: product.barcode,
            unit: product.unit,
            originalSellingPrice: product.sellingPrice,
            sellingPrice: price,
            quantity: qty,
            maxStock: product.stock
          }
        ];
      }
    });

    setTempRowInputs(prev => {
      const next = { ...prev };
      delete next[product.id];
      return next;
    });

    setSuccessMsg(`"${product.name}" savatga qo'shildi!`);
    setTimeout(() => setSuccessMsg(''), 1500);
  };

  const setItemCustomPrice = (productId, rawPrice, originalPrice) => {
    const newPrice = parseFloat(rawPrice) || 0;
    const origPrice = originalPrice || 1;
    const newQty = parseFloat((newPrice / origPrice).toFixed(3));
    setCart(prev => prev.map(item =>
      item.productId === productId
        ? { ...item, sellingPrice: newPrice, quantity: Math.max(0.001, newQty) }
        : item
    ));
  };

  const removeFromCart = (productId) => setCart(prev => prev.filter(i => i.productId !== productId));

  const calculateSubtotal = () =>
    cart.reduce((sum, item) => sum + item.sellingPrice, 0);
  const calculateTotal = () => Math.max(0, calculateSubtotal() - discount);

  const selectDebtor = (name) => {
    setCustomerName(name);
    setShowDebtorSuggestions(false);
    if (barcodeInputRef.current) barcodeInputRef.current.focus();
  };

  const filteredDebtors = debtors.filter(d =>
    d.toLowerCase().includes(customerName.toLowerCase()) && customerName.length > 0
  );

  const sendTelegramNotification = async (sale) => {
    try {
      const savedSettings = JSON.parse(localStorage.getItem('shopSettings')) || {};
      const token = savedSettings.tgBotToken;
      const chatId = savedSettings.tgChatId;
      if (!token || !chatId) return;

      const itemsText = sale.items.map(item => {
        const pName = item.product?.name || 'Mahsulot';
        const pUnit = item.product?.unit || 'dona';
        return `• ${pName}: ${item.quantity} ${pUnit} x ${item.sellingPrice.toLocaleString()} UZS = ${item.total.toLocaleString()} UZS`;
      }).join('\n');

      const text = `📝 *YANGI SOTUV!*\n` +
        `🧾 *Chek:* ${sale.receiptNumber}\n` +
        `👤 *Xaridor:* ${sale.customerName}\n` +
        `💵 *To'lov turi:* ${sale.paymentType === 'CASH' ? 'Naqd' : sale.paymentType === 'CARD' ? 'Qarz' : 'Click/Payme'}\n\n` +
        `*Mahsulotlar:*\n${itemsText}\n\n` +
        `------------------------\n` +
        `*Jami:* ${sale.totalAmount.toLocaleString()} UZS\n` +
        `*Chegirma:* ${sale.discountAmount.toLocaleString()} UZS\n` +
        `*To'lov summasi:* ${(sale.totalAmount).toLocaleString()} UZS`;

      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: 'Markdown'
        })
      });
    } catch (err) {
      console.error('Telegram notification error:', err);
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setCheckoutLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          items: cart.map(item => ({ productId: item.productId, quantity: item.quantity })),
          discountAmount: discount,
          paymentType,
          customerName: customerName.trim()
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Sotuvni yakunlashda xatolik yuz berdi');

      onTriggerPrint(data);
      sendTelegramNotification(data);
      
      setCart([]);
      setDiscount(0);
      setCustomerName('');
      setSuccessMsg('Sotuv yakunlandi!');
      setTimeout(() => setSuccessMsg(''), 1500);
      fetchProducts();
      fetchDebtors();
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(''), 1500);
    } finally {
      setCheckoutLoading(false);
    }
  };

  const filteredProducts = products.filter(p => {
    const q = searchQuery.toLowerCase().trim();
    return p.name.toLowerCase().includes(q) || (p.barcode && p.barcode.includes(q));
  });

  return (
    <div className="flex flex-col lg:flex-row gap-6 text-white" style={{ minHeight: 'calc(100vh - 80px)' }}>
      {/* ─── LEFT: Product Catalog ──────────────────────────────── */}
      <div className="flex-1 flex flex-col gap-4">
        
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 bg-slate-900/40 border border-slate-800 p-4 rounded-3xl backdrop-blur-md">
          {/* Barcode scanner cell */}
          <form onSubmit={handleScannerSubmit} className="w-60 relative">
            <span className="absolute inset-y-0 left-0 pl-4 flex items-center">
              <Barcode size={17} className="text-emerald-400" />
            </span>
            <input
              ref={barcodeInputRef}
              type="text"
              placeholder="Skanerni kuting..."
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-950/70 border border-emerald-500/30 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm font-semibold"
            />
          </form>

          {/* Search */}
          <div className="flex-1 min-w-[180px] relative">
            <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400">
              <Search size={17} />
            </span>
            <input
              id="searchQueryInput"
              type="text"
              placeholder="Mahsulot nomi yoki barkod..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-950/60 border border-slate-800 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
            />
          </div>

          <button onClick={fetchProducts} className="p-3 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl transition-all cursor-pointer" title="Yangilash">
            <RefreshCw size={17} />
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="bg-red-500/15 border border-red-500/30 p-3 rounded-2xl flex items-center gap-3 text-red-200 text-sm">
            <AlertTriangle size={16} className="text-red-400 shrink-0" /><span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="bg-emerald-500/15 border border-emerald-500/30 p-3 rounded-2xl flex items-center gap-3 text-emerald-200 text-sm">
            <Barcode size={16} className="text-emerald-400 shrink-0" /><span>{successMsg}</span>
          </div>
        )}

        {/* Product Table */}
        <div className="bg-slate-900/30 border border-slate-850 rounded-3xl overflow-hidden flex-1" style={{ maxHeight: 'calc(100vh - 215px)', overflowY: 'auto' }}>
          {filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">Mahsulotlar topilmadi</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-900 z-10">
                <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider font-semibold">
                  <th className="py-4 px-6">Mahsulot nomi</th>
                  <th className="py-4 px-6">Barkod</th>
                  <th className="py-4 px-6 text-right">Sotish narxi</th>
                  <th className="py-4 px-6 text-center">Miqdor / Narxni sozlash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/50 text-sm">
                {filteredProducts.map(prod => {
                  const cartItem = cart.find(c => c.productId === prod.id);
                  return (
                    <tr
                      key={prod.id}
                      onClick={() => { if (!cartItem) addToCart(prod); }}
                      className={`transition-colors group ${
                        cartItem
                          ? 'bg-emerald-500/5 border-l-2 border-emerald-500/40'
                          : 'hover:bg-slate-950/30 cursor-pointer'
                      }`}
                    >
                      <td className="py-3 px-6 font-semibold text-white group-hover:text-emerald-400 transition-colors">
                        {prod.name}
                        {cartItem && (
                          <span className="ml-2 text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full font-normal">
                            savatchada
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-6 font-mono text-slate-400 text-xs">{prod.barcode || '—'}</td>
                      <td className="py-3 px-6 text-right text-emerald-400 font-bold">{prod.sellingPrice.toLocaleString()} UZS</td>
                      <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                        {(() => {
                          const rowData = getRowData(prod.id, prod.sellingPrice);
                          return (
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                              {/* Qty controls */}
                              <div className="flex items-center gap-1">
                                {rowData.inCart && (
                                  <button
                                    onClick={() => updateCartQty(prod.id, -1)}
                                    className="w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white rounded-lg cursor-pointer transition-all"
                                    title="-1"
                                  ><Minus size={12} /></button>
                                )}
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={rowData.quantity}
                                  onChange={e => handleRowQtyChange(prod.id, e.target.value, prod.stock, prod.sellingPrice)}
                                  onBlur={() => {
                                    if (rowData.inCart) {
                                      commitCartQty(prod.id, rowData.quantity, prod.stock);
                                    }
                                  }}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      handleRowAddOrUpdate(prod);
                                    }
                                  }}
                                  className={`w-16 text-center bg-slate-900 border rounded-lg text-white font-bold text-sm py-1 focus:outline-none ${
                                    rowData.inCart ? 'border-emerald-500/50' : 'border-slate-800 focus:border-emerald-500'
                                  }`}
                                />
                                {rowData.inCart ? (
                                  <button
                                    onClick={() => updateCartQty(prod.id, 1)}
                                    className="w-8 h-8 flex items-center justify-center bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded-lg cursor-pointer transition-all"
                                    title="+1"
                                  ><Plus size={12} /></button>
                                ) : (
                                  <button
                                    onClick={() => handleRowAddOrUpdate(prod)}
                                    className="w-8 h-8 flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg cursor-pointer transition-all shadow-md"
                                    title="Savatga qo'shish"
                                  ><Plus size={12} /></button>
                                )}
                              </div>

                              {/* Custom Price edit */}
                              <div className="relative w-32">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={rowData.sellingPrice}
                                  onChange={e => handleRowPriceChange(prod.id, e.target.value, prod.sellingPrice)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      handleRowAddOrUpdate(prod);
                                    }
                                  }}
                                  className={`w-full pl-2 pr-8 py-1 bg-slate-900 border rounded-lg font-bold text-xs focus:outline-none text-right ${
                                    rowData.inCart ? 'border-emerald-500/50 text-emerald-400' : 'border-slate-800 focus:border-emerald-500 text-slate-300'
                                  }`}
                                />
                                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-500 text-[9px] pointer-events-none">UZS</span>
                              </div>
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ─── RIGHT: Cart Panel (Full Height - Display Only) ──────── */}
      <div 
        className="w-full lg:w-[460px] bg-slate-900/50 border border-slate-850 rounded-3xl p-4 backdrop-blur-xl flex flex-col sticky top-20 shadow-2xl"
        style={{ height: 'calc(100vh - 110px)' }}
      >
        {/* Cart Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <ShoppingCart className="text-emerald-400" size={18} />
            <span>Savatcha ({cart.length})</span>
          </h2>
          <span className="text-xs text-slate-400">{user?.fullName}</span>
        </div>

        {/* Cart Items — Scrollable (TALL CONTAINER) */}
        <div className="flex-1 overflow-y-auto py-2 min-h-0">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm gap-2">
              <ShoppingCart size={30} className="stroke-[1.5]" />
              <span>Savat bo'sh</span>
            </div>
          ) : (
            <div className="border border-slate-800/80 rounded-2xl bg-slate-950/40 overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-950/90 backdrop-blur-sm z-10 border-b border-slate-800">
                  <tr className="text-slate-400 uppercase tracking-wider font-semibold">
                    <th className="py-2.5 px-3">Nomi</th>
                    <th className="py-2.5 px-3 text-right">Soni</th>
                    <th className="py-2.5 px-3 text-right">Narx</th>
                    <th className="py-2.5 px-3 text-right">Jami</th>
                    <th className="py-2.5 px-3 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/60">
                  {cart.map(item => (
                    <tr key={item.productId} className="hover:bg-slate-900/35 transition-colors">
                      <td className="py-2 px-3 font-semibold text-white truncate max-w-[130px]" title={item.name}>
                        {item.name}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-slate-300">
                        {item.quantity}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-400">
                        {item.originalSellingPrice.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-right text-emerald-400 font-bold">
                        {item.sellingPrice.toLocaleString()}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <button 
                          onClick={() => removeFromCart(item.productId)} 
                          className="p-1 text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Bottom Fixed Section (COMPACT) */}
        <div className="pt-3 space-y-2.5 shrink-0 border-t border-slate-800/50">

          {/* Payment type selection */}
          <div>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { type: 'CASH', label: "Naqd", icon: <Wallet size={12} /> },
                { type: 'CARD', label: "Qarz", icon: <HandCoins size={12} /> },
                { type: 'CLICK_PAYME', label: "Click", icon: <Smartphone size={12} /> }
              ].map(({ type, label, icon }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setPaymentType(type)}
                  className={`py-1.5 px-2 rounded-xl border text-[11px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    paymentType === type
                      ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                      : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  {icon}<span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Combined Inputs Side-by-Side (Discount + Customer) */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[9px] text-slate-400 font-semibold uppercase tracking-wider mb-1">Chegirma (UZS)</label>
              <input
                id="discountInput"
                type="number"
                value={discount || ''}
                onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                placeholder="0"
                className="w-full px-2 py-1.5 bg-slate-950/50 border border-slate-800 rounded-xl text-white placeholder-slate-650 focus:outline-none focus:border-emerald-500 text-xs"
              />
            </div>
            <div className="relative">
              <label className="block text-[9px] text-slate-400 font-semibold uppercase tracking-wider mb-1">
                Xaridor {paymentType === 'CARD' && <span className="text-amber-400">(Qarzdor)</span>}
              </label>
              <input
                id="customerNameInput"
                ref={customerNameRef}
                type="text"
                placeholder="Xaridor"
                value={customerName}
                onChange={(e) => { setCustomerName(e.target.value); setShowDebtorSuggestions(true); }}
                onFocus={() => setShowDebtorSuggestions(paymentType === 'CARD')}
                onBlur={() => setTimeout(() => setShowDebtorSuggestions(false), 150)}
                className="w-full px-2 py-1.5 bg-slate-950/50 border border-slate-800 rounded-xl text-white placeholder-slate-650 focus:outline-none focus:border-emerald-500 text-xs"
              />
              {/* Debtor suggestions dropdown */}
              {showDebtorSuggestions && paymentType === 'CARD' && filteredDebtors.length > 0 && (
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden max-h-40 overflow-y-auto">
                  {filteredDebtors.map(name => (
                    <button
                      key={name}
                      type="button"
                      onMouseDown={() => selectDebtor(name)}
                      className="w-full text-left px-3 py-2 text-xs text-white hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <HandCoins size={12} className="text-amber-400 shrink-0" />
                      <span className="truncate">{name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Totals */}
          <div className="bg-slate-950/40 border border-slate-850 p-2.5 rounded-xl space-y-0.5">
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Jami:</span><span>{calculateSubtotal().toLocaleString()} UZS</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-[11px] text-red-400">
                <span>Chegirma:</span><span>-{discount.toLocaleString()} UZS</span>
              </div>
            )}
            <div className="flex justify-between font-bold border-t border-slate-800/80 pt-1 text-white">
              <span className="text-xs">To'lov:</span>
              <span className="text-emerald-400 text-sm">{calculateTotal().toLocaleString()} UZS</span>
            </div>
          </div>

          {/* Checkout Button */}
          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || checkoutLoading}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 text-xs shadow-lg shadow-emerald-600/20"
          >
            <Printer size={14} />
            <span>{checkoutLoading ? 'Yuklanmoqda...' : 'Sotish va Chek chiqarish'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

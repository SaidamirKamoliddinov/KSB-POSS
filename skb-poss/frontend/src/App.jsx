import React, { useState, useEffect, useRef, useCallback } from 'react';
import Login from './components/Login.jsx';
import POS from './components/POS.jsx';
import Dashboard from './components/Dashboard.jsx';
import Receipt from './components/Receipt.jsx';
import SuperAdmin from './components/SuperAdmin.jsx';
import PinLock from './components/PinLock.jsx';
import CallCenter from './components/CallCenter.jsx';
import { LogOut, LayoutDashboard, ShoppingCart, Lock, X, Settings, Download } from 'lucide-react';

const INACTIVITY_MS = 60 * 60 * 1000; // 1 hour

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || 'null'));
  const [activeTab, setActiveTab] = useState('pos');
  const [activePrintSale, setActivePrintSale] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const inactivityTimer = useRef(null);

  // ── Inactivity Timer ─────────────────────────────────────────────────────────
  const resetTimer = useCallback(() => {
    if (!token) return;
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      const pinKey = `pin_${JSON.parse(localStorage.getItem('user') || '{}')?.id}`;
      const hasPin = !!localStorage.getItem(pinKey);
      if (hasPin) setIsLocked(true);
    }, INACTIVITY_MS);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();
    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [token, resetTimer]);

  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);

  // ── PWA Installation Listener ────────────────────────────────────────────────
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setShowInstallBtn(false);
      console.log('[KSB POSS] App installed successfully');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('[KSB POSS] User accepted install prompt');
    }
    setDeferredPrompt(null);
    setShowInstallBtn(false);
  };

  // ── Login / Logout ────────────────────────────────────────────────────────────
  const handleLoginSuccess = (newToken, newUser) => {
    setToken(newToken);
    setUser(newUser);
    setIsLocked(false);

    // Save shop settings to localStorage dynamically on login
    if (newUser.shop) {
      const settings = {
        shopName: newUser.shop.name,
        address: newUser.shop.address,
        phone: newUser.shop.phone,
        tgBotToken: newUser.shop.tgBotToken || '',
        tgChatId: newUser.shop.tgChatId || '',
        printReceipt: true,
        receiptWidth: '80mm'
      };
      localStorage.setItem('shopSettings', JSON.stringify(settings));
    }

    if (newUser.role === 'SUPER_ADMIN') setActiveTab('superadmin');
    else setActiveTab('pos');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('shopSettings'); // Clear settings on logout to isolate users
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    setToken(null);
    setUser(null);
    setIsLocked(false);
  };

  // ── Print receipt ─────────────────────────────────────────────────────────────
  const triggerPrintReceipt = (saleData) => setActivePrintSale(saleData);

  useEffect(() => {
    if (activePrintSale) {
      const saved = JSON.parse(localStorage.getItem('shopSettings')) || {};
      if (saved.printReceipt !== false) {
        const t = setTimeout(() => { window.print(); setActivePrintSale(null); }, 100);
        return () => clearTimeout(t);
      } else {
        setActivePrintSale(null);
      }
    }
  }, [activePrintSale]);

  // ── Not logged in ─────────────────────────────────────────────────────────────
  if (!token) {
    return (
      <div className="min-h-screen bg-[#07090e] flex flex-col font-sans">
        <Login onLoginSuccess={handleLoginSuccess} />
        <CallCenter />
      </div>
    );
  }

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="min-h-screen bg-[#07090e] flex flex-col font-sans">

      {/* PIN Lock Overlay */}
      {isLocked && (
        <PinLock
          userId={user?.id}
          userFullName={user?.fullName}
          onUnlock={() => { setIsLocked(false); resetTimer(); }}
        />
      )}

      {/* Header */}
      <header className="no-print bg-[#0c101b] border-b border-slate-800 h-16 px-6 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center flex-shrink-0">
            <img src="/favicon.svg" alt="KSB POSS" style={{width: '34px', height: '34px', borderRadius: '10px', background: '#0c101b', padding: '2px'}} />
          </div>
          <h1 className="text-base font-bold text-white tracking-wide flex items-center gap-1.5 leading-none">
            KSB POSS
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-normal">v1.0</span>
          </h1>
        </div>

        {/* Tab nav (Admin only) */}
        {isAdmin && !isSuperAdmin && (
          <nav className="flex items-center gap-2">
            {[
              { id: 'pos', label: 'Kassa', icon: <ShoppingCart size={14} /> },
              { id: 'dashboard', label: 'Boshqaruv', icon: <LayoutDashboard size={14} /> }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold tracking-wider transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                }`}
              >
                {tab.icon}<span>{tab.label}</span>
              </button>
            ))}
          </nav>
        )}

        {/* User info + actions */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-xs font-semibold text-white">{user?.fullName}</span>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider">
              {isSuperAdmin ? 'Super Admin' : isAdmin ? 'Administrator' : 'Kassir'}
            </span>
          </div>

          {/* PWA Install Button */}
          {showInstallBtn && (
            <button
              onClick={handleInstallApp}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-lg shadow-emerald-600/10"
              title="Ilovani ekranga yuklab olish"
            >
              <Download size={14} />
              <span>Yuklab olish</span>
            </button>
          )}

          {/* PIN Setup button */}
          {user?.id && (
            <button
              onClick={() => setShowPinSetup(true)}
              className="p-2.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-amber-400 border border-slate-800 rounded-xl transition-all cursor-pointer"
              title="PIN kodni sozlash"
            >
              <Settings size={15} />
            </button>
          )}

          {/* Manual lock button */}
          {user?.id && localStorage.getItem(`pin_${user.id}`) && (
            <button
              onClick={() => setIsLocked(true)}
              className="p-2.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-amber-400 border border-slate-800 rounded-xl transition-all cursor-pointer"
              title="Ekranni qulflash"
            >
              <Lock size={15} />
            </button>
          )}

          <button
            onClick={handleLogout}
            className="p-2.5 bg-slate-900 hover:bg-red-950/30 text-slate-400 hover:text-red-400 border border-slate-800 rounded-xl transition-all cursor-pointer"
            title="Tizimdan chiqish"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="no-print flex-1 p-6 max-w-7xl w-full mx-auto">
        {isSuperAdmin ? (
          <SuperAdmin token={token} user={user} />
        ) : activeTab === 'pos' ? (
          <POS token={token} user={user} onTriggerPrint={triggerPrintReceipt} />
        ) : (
          <Dashboard token={token} user={user} />
        )}
      </main>

      {/* Print layer */}
      {activePrintSale && (
        <div className="hidden print:block">
          <Receipt sale={activePrintSale} />
        </div>
      )}

      {/* PIN Setup Modal */}
      {showPinSetup && (
        <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 relative shadow-2xl space-y-6">
            <button 
              onClick={() => { setShowPinSetup(false); setPinInput(''); setPinConfirm(''); }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 cursor-pointer"
            >
              <X size={20} />
            </button>
            
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                <Lock size={20} className="text-amber-400" />
              </div>
              <div>
                <h3 className="font-bold text-white text-lg">PIN kod sozlamasi</h3>
                <p className="text-xs text-slate-400">Ekran qulflanganda ochish uchun 4 xonali kod</p>
              </div>
            </div>

            {localStorage.getItem(`pin_${user?.id}`) && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl text-emerald-400 text-xs flex items-center justify-between gap-3">
                <span>✅ PIN kod o'rnatilgan</span>
                <button
                  onClick={() => {
                    localStorage.removeItem(`pin_${user?.id}`);
                    alert('PIN kod muvaffaqiyatli o\'chirildi!');
                    setShowPinSetup(false);
                  }}
                  className="text-xs text-red-400 hover:text-red-300 border border-red-500/20 px-2 py-1 rounded-lg cursor-pointer font-bold"
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
                onClick={() => {
                  if (pinInput.length !== 4 || !/^\d{4}$/.test(pinInput)) {
                    alert('PIN kod 4 ta raqamdan iborat bo\'lishi kerak');
                    return;
                  }
                  if (pinInput !== pinConfirm) {
                    alert('PIN kodlar mos kelmaydi');
                    return;
                  }
                  localStorage.setItem(`pin_${user?.id}`, pinInput);
                  setPinInput('');
                  setPinConfirm('');
                  alert('PIN kod o\'rnatildi!');
                  setShowPinSetup(false);
                }}
                className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-xl transition-all cursor-pointer font-bold"
              >
                PIN kodni saqlash
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Call Center - always visible */}
      <CallCenter />
    </div>
  );
}

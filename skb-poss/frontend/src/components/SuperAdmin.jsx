import React, { useState, useEffect, useRef } from 'react';
import { API_URL } from '../config.js';
import { 
  Users, ShoppingBag, Phone, MapPin, User, Eye, EyeOff, 
  RefreshCw, AlertTriangle, Search, Lock, Unlock, Trash2, X, Shield,
  Settings, Save, Globe, Send, KeyRound, Headphones
} from 'lucide-react';

const DEFAULT_CALL_CENTER = {
  name: 'Kamoliddinov Saidamir Bobirovich',
  phone: '+998949902757',
  instagram: 'https://www.instagram.com/kamoliddinovv__s7?igsh=MXVjNTBrMWozams1eg==',
  telegram: '@bob1rovc',
  address: 'Surxondaryo viloyati Sherobod tumani Zarabog mahallasi 262-uy'
};

export default function SuperAdmin({ token, user }) {
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'settings'
  const [users, setUsers] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Show/hide pw toggles for settings
  const [showOldPw, setShowOldPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [showDeletePw, setShowDeletePw] = useState(false);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const deletePasswordRef = useRef(null);

  // Self settings
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newUsername, setNewUsername] = useState(user?.username || '');

  // PIN code
  const [pinInput, setPinInput] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const pinKey = `pin_${user?.id}`;
  const currentPin = localStorage.getItem(pinKey);

  // Call center settings
  const [ccInfo, setCcInfo] = useState(() => {
    return JSON.parse(localStorage.getItem('callCenterInfo') || 'null') || { ...DEFAULT_CALL_CENTER };
  });

  useEffect(() => { fetchAllUsers(); }, []);

  useEffect(() => {
    if (!searchQuery.trim()) { setFiltered(users); return; }
    const q = searchQuery.toLowerCase();
    setFiltered(users.filter(u =>
      u.fullName?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      u.shopName?.toLowerCase().includes(q) ||
      u.phone?.includes(q) ||
      u.address?.toLowerCase().includes(q)
    ));
  }, [searchQuery, users]);

  useEffect(() => {
    if (deleteTarget && deletePasswordRef.current) {
      setTimeout(() => deletePasswordRef.current?.focus(), 100);
    }
  }, [deleteTarget]);

  const notify = (type, msg) => {
    if (type === 'success') { setSuccess(msg); setError(''); }
    else { setError(msg); setSuccess(''); }
    setTimeout(() => { setSuccess(''); setError(''); }, 2500);
  };

  const fetchAllUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/all-users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) { setUsers(data); setFiltered(data); }
      else notify('error', data.error);
    } catch { notify('error', 'Ma\'lumotlarni yuklashda xatolik'); }
    finally { setLoading(false); }
  };

  const togglePassword = (id) => setVisiblePasswords(prev => ({ ...prev, [id]: !prev[id] }));

  const handleToggleBlock = async (u) => {
    try {
      const res = await fetch(`${API_URL}/auth/users/${u.id}/toggle-block`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) { notify('success', data.message); fetchAllUsers(); }
      else notify('error', data.error);
    } catch { notify('error', 'Xatolik yuz berdi'); }
  };

  const openDeleteModal = (u) => { setDeleteTarget(u); setDeletePassword(''); setDeleteError(''); };
  const closeDeleteModal = () => { setDeleteTarget(null); setDeletePassword(''); setDeleteError(''); };

  const handleDeleteUser = async (e) => {
    e.preventDefault();
    if (!deletePassword.trim()) { setDeleteError('Parolni kiriting'); return; }
    setDeleteLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/users/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ superAdminPassword: deletePassword })
      });
      const data = await res.json();
      if (res.ok) {
        closeDeleteModal();
        notify('success', `"${deleteTarget.fullName}" o'chirildi`);
        fetchAllUsers();
      } else setDeleteError(data.error || 'Xatolik');
    } catch { setDeleteError('Tarmoq xatoligi'); }
    finally { setDeleteLoading(false); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!oldPassword || !newPassword) { notify('error', 'Barcha maydonlarni to\'ldiring'); return; }
    if (newPassword !== confirmPassword) { notify('error', 'Yangi parollar mos kelmaydi'); return; }
    try {
      const res = await fetch(`${API_URL}/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ oldPassword, newPassword })
      });
      const data = await res.json();
      if (res.ok) {
        notify('success', 'Parol muvaffaqiyatli o\'zgartirildi!');
        setOldPassword(''); setNewPassword(''); setConfirmPassword('');
      } else notify('error', data.error);
    } catch { notify('error', 'Server xatoligi'); }
  };

  const handleSavePin = () => {
    if (pinInput.length !== 4 || !/^\d{4}$/.test(pinInput)) { notify('error', 'PIN kod 4 ta raqamdan iborat bo\'lishi kerak'); return; }
    if (pinInput !== pinConfirm) { notify('error', 'PIN kodlar mos kelmaydi'); return; }
    localStorage.setItem(pinKey, pinInput);
    notify('success', 'PIN kod o\'rnatildi!');
    setPinInput(''); setPinConfirm('');
  };

  const handleRemovePin = () => {
    localStorage.removeItem(pinKey);
    notify('success', 'PIN kod o\'chirildi');
  };

  const handleSaveCallCenter = (e) => {
    e.preventDefault();
    localStorage.setItem('callCenterInfo', JSON.stringify(ccInfo));
    notify('success', 'Call center ma\'lumotlari saqlandi!');
  };

  const getDaysLeft = (createdAt) => {
    const diff = 30 - (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
    return Math.max(0, Math.floor(diff));
  };

  return (
    <div className="space-y-6 text-white">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-3">
            <span className="bg-gradient-to-br from-purple-400 to-pink-500 text-white rounded-2xl p-2">
              <Shield size={22} />
            </span>
            Super Admin Paneli
          </h2>
          <p className="text-sm text-slate-400 mt-1">Tizim boshqaruvi va foydalanuvchilar</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold px-4 py-2 rounded-xl">
            {users.length} foydalanuvchi
          </span>
          <button onClick={fetchAllUsers} className="p-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-all cursor-pointer" title="Yangilash">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex border-b border-slate-800 gap-1">
        {[
          { id: 'users', label: 'Foydalanuvchilar', icon: <Users size={15} /> },
          { id: 'settings', label: 'Mening Sozlamalarim', icon: <Settings size={15} /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-4 px-5 font-bold text-sm transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
              activeTab === tab.id ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            {tab.icon}<span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Notifications */}
      {error && (
        <div className="bg-red-500/15 border border-red-500/30 p-4 rounded-2xl flex items-center gap-3 text-red-200 text-sm">
          <AlertTriangle size={18} className="text-red-400 shrink-0" /><span>{error}</span>
        </div>
      )}
      {success && (
        <div className="bg-emerald-500/15 border border-emerald-500/30 p-4 rounded-2xl flex items-center gap-3 text-emerald-200 text-sm">
          <Shield size={18} className="text-emerald-400 shrink-0" /><span>{success}</span>
        </div>
      )}

      {/* ── TAB 1: USERS ─────────────────────────────────────────────────── */}
      {activeTab === 'users' && (
        <div className="space-y-5">
          {/* Search */}
          <div className="relative">
            <span className="absolute inset-y-0 left-4 flex items-center text-slate-400 pointer-events-none"><Search size={17} /></span>
            <input
              type="text"
              placeholder="Ism, login, do'kon nomi, telefon yoki manzil..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-slate-900/60 border border-slate-800 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-all"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute inset-y-0 right-4 flex items-center text-slate-400 hover:text-white cursor-pointer"><X size={15} /></button>
            )}
          </div>

          {loading ? (
            <div className="text-center py-12 text-slate-500">Yuklanmoqda...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <Users size={48} className="mx-auto mb-4 stroke-[1]" />
              <p>{searchQuery ? 'Qidiruv natijasi topilmadi' : 'Foydalanuvchilar yo\'q'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filtered.map(u => {
                const daysLeft = getDaysLeft(u.createdAt);
                const isExpiring = daysLeft <= 5 && daysLeft > 0;
                return (
                  <div key={u.id} className={`bg-slate-900/50 border rounded-3xl p-5 space-y-4 transition-all ${
                    u.isBlocked ? 'border-red-500/30 opacity-75' : isExpiring ? 'border-amber-500/30' : 'border-slate-800 hover:border-slate-700'
                  }`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg shrink-0 ${
                        u.isBlocked ? 'bg-gradient-to-br from-red-500 to-rose-700' : 'bg-gradient-to-br from-emerald-400 to-blue-500'
                      }`}>
                        {u.fullName?.charAt(0)?.toUpperCase() || 'U'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-white truncate">{u.fullName}</h3>
                        <div className="flex items-center gap-2 flex-wrap mt-1">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${u.role === 'ADMIN' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-slate-700 text-slate-300'}`}>
                            {u.role === 'ADMIN' ? 'Admin' : 'Kassir'}
                          </span>
                          {u.isBlocked ? (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">Bloklangan</span>
                          ) : u.isExpired ? (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">Muddati tugagan</span>
                          ) : (
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isExpiring ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                              {daysLeft} kun qoldi
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm border-t border-slate-800 pt-4">
                      <div className="flex items-center gap-2 text-slate-300">
                        <ShoppingBag size={14} className="text-emerald-400 shrink-0" />
                        <span className="font-medium truncate">{u.shopName}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-400">
                        <MapPin size={14} className="text-slate-500 shrink-0" />
                        <span className="truncate text-xs">{u.address}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-400">
                        <Phone size={14} className="text-slate-500 shrink-0" />
                        <span className="text-xs">{u.phone}</span>
                      </div>
                    </div>

                    <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3 space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 flex items-center gap-1.5"><User size={11} /> Login:</span>
                        <span className="font-mono font-bold text-white">{u.username}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 flex items-center gap-1.5"><Eye size={11} /> Parol:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-amber-300">
                            {visiblePasswords[u.id] ? (u.plainPassword || '—') : '••••••••'}
                          </span>
                          <button onClick={() => togglePassword(u.id)} className="text-slate-500 hover:text-white transition-colors cursor-pointer">
                            {visiblePasswords[u.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => handleToggleBlock(u)}
                        className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                          u.isBlocked
                            ? 'bg-emerald-600/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-600 hover:text-white'
                            : 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-600 hover:text-white'
                        }`}
                      >
                        {u.isBlocked ? <Unlock size={13} /> : <Lock size={13} />}
                        <span>{u.isBlocked ? 'Ochish' : 'Bloklash'}</span>
                      </button>
                      <button onClick={() => openDeleteModal(u)} className="px-3 py-2 bg-slate-800 border border-slate-700 text-slate-400 hover:bg-red-600 hover:text-white hover:border-red-600 rounded-xl text-xs transition-all cursor-pointer" title="O'chirish">
                        <Trash2 size={13} />
                      </button>
                    </div>

                    <div className="text-[10px] text-slate-500 text-right">
                      Ro'yxatdan o'tgan: {new Date(u.createdAt).toLocaleDateString('uz-UZ')}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: MY SETTINGS ────────────────────────────────────────────── */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Change Password */}
          <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl space-y-5">
            <h3 className="font-bold text-lg text-white flex items-center gap-2">
              <KeyRound size={20} className="text-purple-400" />
              <span>Parolni o'zgartirish</span>
            </h3>
            <form onSubmit={handleChangePassword} className="space-y-4">
              {[
                { label: 'Eski parol', val: oldPassword, set: setOldPassword, show: showOldPw, toggle: () => setShowOldPw(v => !v) },
                { label: 'Yangi parol', val: newPassword, set: setNewPassword, show: showNewPw, toggle: () => setShowNewPw(v => !v) },
                { label: 'Yangi parolni tasdiqlang', val: confirmPassword, set: setConfirmPassword, show: showConfirmPw, toggle: () => setShowConfirmPw(v => !v) },
              ].map(({ label, val, set, show, toggle }) => (
                <div key={label}>
                  <label className="block text-xs text-slate-400 font-semibold mb-2">{label}</label>
                  <div className="relative">
                    <input
                      type={show ? 'text' : 'password'}
                      required
                      value={val}
                      onChange={e => set(e.target.value)}
                      className="w-full px-4 pr-12 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-purple-500"
                      placeholder="••••••••"
                    />
                    <button type="button" onClick={toggle} className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-white cursor-pointer" tabIndex={-1}>
                      {show ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              ))}
              <button type="submit" className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl transition-all cursor-pointer">
                Parolni yangilash
              </button>
            </form>
          </div>

          {/* PIN Code Setup */}
          <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl space-y-5">
            <h3 className="font-bold text-lg text-white flex items-center gap-2">
              <Lock size={20} className="text-amber-400" />
              <span>PIN kod sozlamasi</span>
            </h3>
            {currentPin && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl text-emerald-400 text-sm flex items-center justify-between gap-3">
                <span>✅ PIN kod o'rnatilgan</span>
                <button onClick={handleRemovePin} className="text-xs text-red-400 hover:text-red-300 cursor-pointer border border-red-500/20 px-2 py-1 rounded-lg">O'chirish</button>
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
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500 text-center text-xl font-bold tracking-[1rem]"
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
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500 text-center text-xl font-bold tracking-[1rem]"
                  placeholder="••••"
                />
              </div>
              <button onClick={handleSavePin} className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-xl transition-all cursor-pointer">
                PIN kodni saqlash
              </button>
              <p className="text-xs text-slate-500 text-center">1 soat faoliyatsizlik bo'lganda PIN ekran avtomatik yoqiladi</p>
            </div>
          </div>

          {/* Call Center Settings */}
          <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl space-y-5 lg:col-span-2">
            <h3 className="font-bold text-lg text-white flex items-center gap-2">
              <Headphones size={20} className="text-emerald-400" />
              <span>Call Center ma'lumotlari</span>
            </h3>
            <form onSubmit={handleSaveCallCenter} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: 'F.I.SH', field: 'name', icon: <User size={13} /> },
                { label: 'Telefon raqami', field: 'phone', icon: <Phone size={13} /> },
                { label: 'Instagram URL', field: 'instagram', icon: <Globe size={13} /> },
                { label: 'Telegram (@ bilan)', field: 'telegram', icon: <Send size={13} /> },
              ].map(({ label, field, icon }) => (
                <div key={field}>
                  <label className="block text-xs text-slate-400 font-semibold mb-2 flex items-center gap-1.5">{icon}{label}</label>
                  <input
                    type="text"
                    value={ccInfo[field] || ''}
                    onChange={e => setCcInfo(prev => ({ ...prev, [field]: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              ))}
              <div className="md:col-span-2">
                <label className="block text-xs text-slate-400 font-semibold mb-2 flex items-center gap-1.5"><MapPin size={13} />Manzil</label>
                <input
                  type="text"
                  value={ccInfo.address || ''}
                  onChange={e => setCcInfo(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="md:col-span-2">
                <button type="submit" className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2">
                  <Save size={16} />
                  <span>Call Center ma'lumotlarini saqlash</span>
                </button>
              </div>
            </form>
          </div>

        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-red-500/30 rounded-3xl w-full max-w-md p-6 relative shadow-2xl">
            <button onClick={closeDeleteModal} className="absolute top-4 right-4 text-slate-400 hover:text-white cursor-pointer"><X size={20} /></button>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl"><Trash2 size={20} className="text-red-400" /></div>
              <div>
                <h3 className="font-bold text-white">Foydalanuvchini o'chirish</h3>
                <p className="text-xs text-slate-400">Bu amalni ortga qaytarib bo'lmaydi</p>
              </div>
            </div>
            <div className="bg-red-500/5 border border-red-500/15 p-4 rounded-2xl mb-5 text-sm text-slate-300">
              <span className="font-bold text-white">"{deleteTarget.fullName}"</span> va uning barcha sotuvlari, mahsulotlari, qarzlari o'chiriladi.
            </div>
            <form onSubmit={handleDeleteUser} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 font-semibold mb-2">Super Admin parolini kiriting:</label>
                <div className="relative">
                  <input
                    ref={deletePasswordRef}
                    type={showDeletePw ? 'text' : 'password'}
                    placeholder="Super Admin paroli"
                    value={deletePassword}
                    onChange={e => setDeletePassword(e.target.value)}
                    className="w-full px-4 pr-12 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-red-500"
                  />
                  <button type="button" onClick={() => setShowDeletePw(v => !v)} className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-white cursor-pointer" tabIndex={-1}>
                    {showDeletePw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {deleteError && <p className="text-red-400 text-xs mt-2 flex items-center gap-1"><AlertTriangle size={12} /> {deleteError}</p>}
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={closeDeleteModal} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium cursor-pointer">Bekor qilish</button>
                <button type="submit" disabled={deleteLoading} className="flex-1 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-xl font-bold cursor-pointer flex items-center justify-center gap-2">
                  {deleteLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Trash2 size={14} /> O'chirish</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { API_URL } from '../config.js';
import { LogIn, Lock, User, AlertCircle, Sparkles, MapPin, Phone, Building, Eye, EyeOff } from 'lucide-react';
import CallCenter from './CallCenter.jsx';

export default function Login({ onLoginSuccess }) {
  const [isRegister, setIsRegister] = useState(false);

  // Login states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Register states
  const [fullName, setFullName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [shopName, setShopName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [registrationKey, setRegistrationKey] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Iltimos, barcha maydonlarni to\'ldiring');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Login yoki parol xato');
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      if (data.user?.shop?.mode) {
        const existing = JSON.parse(localStorage.getItem('shopSettings') || '{}');
        existing.shopMode = data.user.shop.mode;
        localStorage.setItem('shopSettings', JSON.stringify(existing));
      }
      onLoginSuccess(data.token, data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!fullName || !newUsername || !newPassword || !shopName || !address || !phone || !registrationKey) {
      setError('Iltimos, barcha maydonlarni to\'ldiring');
      return;
    }
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
          fullName,
          role: 'ADMIN',
          shopName: shopName.trim(),
          address: address.trim(),
          phone: phone.trim(),
          registrationKey: registrationKey.trim()
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Ro\'yxatdan o\'tishda xatolik yuz berdi');

      const shopSettings = {
        shopName: shopName.trim(),
        address: address.trim(),
        phone: phone.trim()
      };
      localStorage.setItem('shopSettings', JSON.stringify(shopSettings));

      setSuccess('Muvaffaqiyatli ro\'yxatdan o\'tdingiz! Tizimga kirilmoqda...');

      setTimeout(async () => {
        try {
          const loginRes = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: newUsername, password: newPassword }),
          });
          const loginData = await loginRes.json();
          if (loginRes.ok) {
            localStorage.setItem('token', loginData.token);
            localStorage.setItem('user', JSON.stringify(loginData.user));
            // Persist shopMode for Receipt to use
            if (loginData.user?.shop?.mode) {
              const existing = JSON.parse(localStorage.getItem('shopSettings') || '{}');
              existing.shopMode = loginData.user.shop.mode;
              localStorage.setItem('shopSettings', JSON.stringify(existing));
            }
            onLoginSuccess(loginData.token, loginData.user);
          } else {
            setIsRegister(false);
            setUsername(newUsername);
            setPassword(newPassword);
          }
        } catch {
          setIsRegister(false);
        }
      }, 1500);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#090d16] px-4 relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-lg bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10 transition-all duration-300">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl mb-4">
            <Building size={28} />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">KSB POSS</h1>
          <p className="text-sm text-slate-400 mt-2">
            {isRegister ? 'Yangi do\'kon va administrator ro\'yxatdan o\'tkazish' : 'Tizimga kirish'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/15 border border-red-500/30 rounded-2xl flex items-center gap-3 text-red-200 text-sm">
            <AlertCircle size={20} className="text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl flex items-center gap-3 text-emerald-200 text-sm animate-pulse">
            <Sparkles size={20} className="text-emerald-400 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* ── LOGIN FORM ─────────────────────────────────────────── */}
        {!isRegister ? (
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Login</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 pointer-events-none">
                  <User size={18} />
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-950/50 border border-slate-800 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all duration-200"
                  placeholder="Foydalanuvchi nomi"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Parol</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 pointer-events-none">
                  <Lock size={18} />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-11 pr-12 py-3 bg-slate-950/50 border border-slate-800 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all duration-200"
                  placeholder="••••••••"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-white transition-colors cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-2xl shadow-lg shadow-emerald-600/25 transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Kutilmoqda...</>
                ) : (
                  <><LogIn size={17} /> Kirish</>
                )}
              </button>

              <button
                type="button"
                onClick={() => { setIsRegister(true); setError(''); }}
                className="w-full py-3 bg-slate-800/50 hover:bg-slate-800 text-slate-300 rounded-2xl text-sm font-semibold transition-all cursor-pointer"
              >
                Yangi do'kon yaratish (Ro'yxatdan o'tish)
              </button>
            </div>
          </form>

        ) : (
          /* ── REGISTER FORM ─────────────────────────────────────── */
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Ism Familiya *</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950/50 border border-slate-800 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  placeholder="Ali Valiyev"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Do'kon nomi *</label>
                <input
                  type="text"
                  value={shopName}
                  onChange={e => setShopName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950/50 border border-slate-800 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  placeholder="KSB Do'koni"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Telefon raqam *</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 pointer-events-none"><Phone size={14} /></span>
                  <input
                    type="text"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-950/50 border border-slate-800 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    placeholder="+998 (99) 123-45-67"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Manzil *</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 pointer-events-none"><MapPin size={14} /></span>
                  <input
                    type="text"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-950/50 border border-slate-800 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    placeholder="Chilonzor tumani"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Login *</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950/50 border border-slate-800 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  placeholder="admin"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Parol *</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full px-4 pr-11 py-2.5 bg-slate-950/50 border border-slate-800 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(v => !v)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white transition-colors cursor-pointer"
                    tabIndex={-1}
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

            </div>

            <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Faollashtirish kaliti *
                </label>
                <input
                  type="text"
                  value={registrationKey}
                  onChange={e => setRegistrationKey(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950/50 border border-amber-500/40 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono tracking-widest"
                  placeholder="KSB-XXXX-XXXX-2026"
                  autoComplete="off"
                />
                <p className="text-[10px] text-slate-500 mt-1">KSB operatori tomonidan berilgan maxsus kalit</p>
              </div>

            <div className="space-y-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-2xl shadow-lg shadow-emerald-600/25 transition-all duration-300 hover:-translate-y-0.5 cursor-pointer flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Kutilmoqda...</>
                ) : (
                  'Ro\'yxatdan o\'tish'
                )}
              </button>

              <button
                type="button"
                onClick={() => { setIsRegister(false); setError(''); }}
                className="w-full py-3 bg-slate-800/50 hover:bg-slate-800 text-slate-300 rounded-2xl text-sm font-semibold transition-all cursor-pointer"
              >
                Katalogga qaytish (Kirish oynasi)
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Call Center - login sahifasida ham ko'rinadi */}
      <CallCenter />
    </div>
  );
}

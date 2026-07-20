import React, { useState, useEffect } from 'react';
import { Lock, Delete, Shield } from 'lucide-react';

export default function PinLock({ onUnlock, userId, userFullName, userPinCode }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  const pinKey = `pin_${userId}`;
  const storedPin = userPinCode || localStorage.getItem(pinKey);

  useEffect(() => {
    // If no PIN is set, unlock immediately
    if (!storedPin) {
      onUnlock();
    }
  }, []);

  const handleDigit = (d) => {
    if (pin.length >= 4 || error) return;
    const newPin = pin + d;
    setPin(newPin);

    if (newPin.length === 4) {
      if (newPin === storedPin) {
        setTimeout(() => onUnlock(), 150);
      } else {
        setShake(true);
        setError(true);
        setTimeout(() => {
          setPin('');
          setError(false);
          setShake(false);
        }, 900);
      }
    }
  };

  const handleDelete = () => {
    if (!error) setPin(prev => prev.slice(0, -1));
  };

  const handleKeyDown = (e) => {
    if (e.key >= '0' && e.key <= '9') handleDigit(e.key);
    if (e.key === 'Backspace') handleDelete();
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin, error]);

  if (!storedPin) return null;

  const pad = [1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'];

  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center select-none">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8 w-full max-w-xs px-6">
        {/* Lock icon + title */}
        <div className="text-center">
          <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-emerald-500/10">
            <Lock size={32} className="text-emerald-400" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">KSB POSS</h2>
          <p className="text-slate-400 text-sm mt-1">{userFullName || 'Foydalanuvchi'}</p>
          <p className="text-slate-500 text-xs mt-1">4 xonali PIN kodni kiriting</p>
        </div>

        {/* PIN dots */}
        <div className={`flex gap-5 ${shake ? 'animate-bounce' : ''}`}>
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`w-5 h-5 rounded-full border-2 transition-all duration-200 ${
                pin.length > i
                  ? error
                    ? 'bg-red-500 border-red-500 shadow-lg shadow-red-500/30'
                    : 'bg-emerald-500 border-emerald-500 shadow-lg shadow-emerald-500/30'
                  : 'border-slate-600 bg-transparent'
              }`}
            />
          ))}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 px-4 py-2 rounded-xl text-red-400 text-sm text-center">
            PIN noto'g'ri. Qayta urinib ko'ring
          </div>
        )}

        {/* Number pad */}
        <div className="grid grid-cols-3 gap-3 w-full">
          {pad.map((d, i) => {
            if (d === null) return <div key={i} />;
            if (d === 'del') return (
              <button
                key={i}
                onClick={handleDelete}
                className="h-16 flex items-center justify-center bg-slate-800/60 border border-slate-700/50 rounded-2xl text-slate-300 hover:bg-slate-700 hover:text-white active:scale-95 transition-all cursor-pointer"
              >
                <Delete size={20} />
              </button>
            );
            return (
              <button
                key={i}
                onClick={() => handleDigit(String(d))}
                className="h-16 flex items-center justify-center bg-slate-800/60 border border-slate-700/50 rounded-2xl text-white text-xl font-bold hover:bg-slate-700 hover:border-emerald-500/30 active:scale-95 transition-all cursor-pointer"
              >
                {d}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 text-slate-600 text-xs">
          <Shield size={11} />
          <span>KSB POSS tomonidan himoyalangan</span>
        </div>
      </div>
    </div>
  );
}

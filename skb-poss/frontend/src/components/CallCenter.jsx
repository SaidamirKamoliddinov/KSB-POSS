import React, { useState } from 'react';
import { Phone, X, Globe, Send, MapPin, User, ChevronDown, ChevronUp, Headphones } from 'lucide-react';


const DEFAULT_CALL_CENTER = {
  name: 'Kamoliddinov Saidamir Bobirovich',
  phone: '+998949902757',
  instagram: 'https://www.instagram.com/kamoliddinovv__s7?igsh=MXVjNTBrMWozams1eg==',
  telegram: '@bob1rovc',
  address: 'Surxondaryo viloyati Sherobod tumani Zarabog mahallasi 262-uy'
};

export default function CallCenter() {
  const [open, setOpen] = useState(false);

  const saved = JSON.parse(localStorage.getItem('callCenterInfo') || 'null');
  const info = saved || DEFAULT_CALL_CENTER;

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-5 right-5 z-[800] group flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-3 rounded-2xl shadow-xl shadow-emerald-600/30 transition-all cursor-pointer no-print"
        title="Call Center"
      >
        <Headphones size={18} />
        <span className="text-sm font-bold hidden sm:inline">Yordam</span>
        {open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </button>

      {/* Popup card */}
      {open && (
        <div className="fixed bottom-20 right-5 z-[800] w-80 bg-slate-900 border border-slate-700/60 rounded-3xl shadow-2xl overflow-hidden no-print animate-in">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                <Headphones size={18} className="text-white" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">Call Center</h3>
                <p className="text-emerald-100 text-xs">KSB POSS qo'llab-quvvatlash</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white cursor-pointer p-1">
              <X size={16} />
            </button>
          </div>

          {/* Contact info */}
          <div className="p-4 space-y-3">
            <div className="flex items-start gap-3 text-sm">
              <div className="w-8 h-8 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                <User size={14} className="text-blue-400" />
              </div>
              <div>
                <span className="text-slate-400 text-xs block">F.I.SH</span>
                <span className="text-white font-semibold leading-snug">{info.name}</span>
              </div>
            </div>

            <a
              href={`tel:${info.phone}`}
              className="flex items-center gap-3 text-sm p-3 bg-emerald-500/5 border border-emerald-500/15 hover:border-emerald-500/40 rounded-2xl transition-all cursor-pointer group"
            >
              <div className="w-8 h-8 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center shrink-0">
                <Phone size={14} className="text-emerald-400" />
              </div>
              <div>
                <span className="text-slate-400 text-xs block">Telefon</span>
                <span className="text-emerald-400 font-bold group-hover:text-emerald-300">{info.phone}</span>
              </div>
            </a>

            <a
              href={info.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 text-sm p-3 bg-pink-500/5 border border-pink-500/15 hover:border-pink-500/40 rounded-2xl transition-all cursor-pointer group"
            >
              <div className="w-8 h-8 bg-pink-500/10 border border-pink-500/20 rounded-xl flex items-center justify-center shrink-0">
                <Globe size={14} className="text-pink-400" />
              </div>
              <div>
                <span className="text-slate-400 text-xs block">Instagram</span>
                <span className="text-pink-400 font-semibold group-hover:text-pink-300 text-xs truncate block max-w-[180px]">@kamoliddinovv__s7</span>
              </div>
            </a>

            <a
              href={`https://t.me/${info.telegram.replace('@', '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 text-sm p-3 bg-blue-500/5 border border-blue-500/15 hover:border-blue-500/40 rounded-2xl transition-all cursor-pointer group"
            >
              <div className="w-8 h-8 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center shrink-0">
                <Send size={14} className="text-blue-400" />
              </div>
              <div>
                <span className="text-slate-400 text-xs block">Telegram</span>
                <span className="text-blue-400 font-semibold group-hover:text-blue-300">{info.telegram}</span>
              </div>
            </a>

            <div className="flex items-start gap-3 text-sm">
              <div className="w-8 h-8 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                <MapPin size={14} className="text-amber-400" />
              </div>
              <div>
                <span className="text-slate-400 text-xs block">Manzil</span>
                <span className="text-slate-300 text-xs leading-snug">{info.address}</span>
              </div>
            </div>
          </div>

          <div className="px-4 pb-4">
            <div className="text-[10px] text-slate-500 text-center bg-slate-950/40 rounded-xl py-2 px-3">
              Ish vaqti: 09:00 – 21:00 (Dushanba – Shanba)
            </div>
          </div>
        </div>
      )}
    </>
  );
}

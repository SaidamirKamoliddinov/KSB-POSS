import React from 'react';

export default function Receipt({ sale }) {
  if (!sale) return null;

  // Retrieve dynamic shop settings from localStorage
  const savedSettings = JSON.parse(localStorage.getItem('shopSettings')) || {
    shopName: "KSB POSS DO'KONI",
    address: "Toshkent sh., Chilonzor tumani",
    phone: "+998 (99) 123-45-67"
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString('uz-UZ', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const calculateSubtotal = () => {
    return sale.items.reduce((sum, item) => sum + (item.sellingPrice * item.quantity), 0);
  };

  const receiptWidth = savedSettings.receiptWidth || '80mm';

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page {
            size: ${receiptWidth} auto !important;
            margin: 0 !important;
          }
          body {
            width: ${receiptWidth} !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}} />
      <div className={`print-area font-mono leading-tight text-black mx-auto p-2 bg-white width-${receiptWidth}`}>
      {/* Receipt Header */}
      <div className="text-center font-bold text-sm mb-2 uppercase">
        {savedSettings.shopName}
      </div>
      <div className="text-center mb-4 text-[10px]">
        {savedSettings.address}<br />
        Tel: {savedSettings.phone}<br />
        Chek: #{sale.receiptNumber}
      </div>

      {/* Seller & Time Info */}
      <div className="border-b border-dashed border-black pb-2 mb-2 text-[10px]">
        <div>Sana: {formatDate(sale.createdAt)}</div>
        <div>Sotuvchi: {sale.cashier?.fullName || 'Tizim foydalanuvchisi'}</div>
        <div>To'lov: {
          sale.paymentType === 'CASH' ? 'Naqd' :
          sale.paymentType === 'CARD' ? 'Qarz' : 'Click / Payme (QR)'
        }</div>
        <div>Xaridor: {sale.customerName}</div>
      </div>

      {/* Item List */}
      <div className="border-b border-dashed border-black pb-2 mb-2">
        <div className="flex justify-between font-bold mb-1 text-[10px]">
          <span className="w-1/2">Nomi</span>
          <span className="w-1/6 text-right">Miqdor</span>
          <span className="w-1/6 text-right">Narxi</span>
          <span className="w-1/6 text-right">Jami</span>
        </div>
        {sale.items.map((item, idx) => (
          <div key={idx} className="flex justify-between text-[11px] mb-1">
            <span className="w-1/2 truncate">{item.product.name}</span>
            <span className="w-1/6 text-right">{item.quantity} {item.product.unit}</span>
            <span className="w-1/6 text-right">{item.sellingPrice.toLocaleString()} UZS</span>
            <span className="w-1/6 text-right">{(item.sellingPrice * item.quantity).toLocaleString()} UZS</span>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="flex flex-col gap-1 text-[11px] mb-4">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>{calculateSubtotal().toLocaleString()} UZS</span>
        </div>
        {sale.discountAmount > 0 && (
          <div className="flex justify-between text-red-600 font-bold">
            <span>Chegirma:</span>
            <span>-{sale.discountAmount.toLocaleString()} UZS</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-sm border-t border-black pt-1">
          <span>Jami Summa:</span>
          <span>{sale.totalAmount.toLocaleString()} UZS</span>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-[9px] mt-4 text-gray-600">
        Xaridingiz uchun rahmat!
      </div>
    </div>
    </>
  );
}

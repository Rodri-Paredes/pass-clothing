import { useEffect, useState } from 'react';
import { fmtMoneyRaw } from '../../lib/formatters';

interface Props {
  discountAmount: number;
  onDiscountChange: (amount: number) => void;
  productDiscount: number;
  subtotal: number;
  total: number;
}

const money = (value: number) => `Bs ${fmtMoneyRaw(value)}`;
const percentageOptions = ['5', '10', '15', '20'];

export default function PosSaleSummary({ discountAmount, onDiscountChange, productDiscount, subtotal, total }: Props) {
  const [discountMode, setDiscountMode] = useState('none');

  useEffect(() => {
    if (subtotal === 0 && discountMode !== 'none') setDiscountMode('none');
  }, [subtotal, discountMode]);

  useEffect(() => {
    if (discountMode === 'none') onDiscountChange(0);
    if (percentageOptions.includes(discountMode)) {
      onDiscountChange(Math.round(subtotal * Number(discountMode)) / 100);
    }
  }, [discountMode, subtotal, onDiscountChange]);

  const handleModeChange = (value: string) => {
    setDiscountMode(value);
    if (value === 'custom') onDiscountChange(discountAmount || 0);
  };

  return <>
    <section className="border-t border-surface-200 py-4"><label className="block text-sm"><span className="mb-2 block text-surface-600">Descuento adicional</span><select value={discountMode} onChange={event => handleModeChange(event.target.value)} className="h-10 w-full border border-surface-300 bg-white px-3 text-sm font-medium outline-none focus:border-surface-950"><option value="none">Sin descuento</option>{percentageOptions.map(value => <option key={value} value={value}>{value}% — {money(subtotal * Number(value) / 100)}</option>)}<option value="custom">Monto personalizado…</option></select></label>{discountMode === 'custom' && <label className="mt-3 flex items-center justify-between gap-3 text-sm"><span className="text-surface-500">Monto en bolivianos</span><span className="flex items-center border-b border-surface-300"><span className="text-xs text-surface-400">Bs</span><input autoFocus type="number" min="0" max={subtotal} step="0.01" value={discountAmount || ''} onChange={event => onDiscountChange(Math.min(subtotal, Math.max(0, Number(event.target.value) || 0)))} className="w-24 border-0 bg-transparent px-2 py-1.5 text-right font-semibold outline-none"/></span></label>}</section>
    <section className="border-t border-surface-200 py-4"><div className="space-y-1.5 text-sm"><div className="flex justify-between text-surface-600"><span>Subtotal</span><span>{money(subtotal)}</span></div>{productDiscount > 0 && <div className="flex justify-between text-surface-500"><span>Promociones</span><span>− {money(productDiscount)}</span></div>}{discountAmount > 0 && <div className="flex justify-between text-surface-500"><span>Descuento</span><span>− {money(discountAmount)}</span></div>}</div><div className="mt-4 flex items-end justify-between"><span className="text-xs font-bold uppercase tracking-[0.18em] text-surface-500">Total</span><span className="text-3xl font-black tracking-tight text-surface-950">{money(total)}</span></div></section>
  </>;
}

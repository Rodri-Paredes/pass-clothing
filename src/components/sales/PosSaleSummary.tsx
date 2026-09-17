import { fmtMoneyRaw } from '../../lib/formatters';

interface Props {
  discountAmount: number;
  onDiscountChange: (amount: number) => void;
  productDiscount: number;
  subtotal: number;
  total: number;
}

const money = (value: number) => `Bs ${fmtMoneyRaw(value)}`;

export default function PosSaleSummary({ discountAmount, onDiscountChange, productDiscount, subtotal, total }: Props) {
  return <>
    <section className="border-t border-surface-200 py-4"><label className="flex items-center justify-between gap-3 text-sm"><span className="text-surface-600">Descuento adicional</span><span className="flex items-center border-b border-surface-300"><span className="text-xs text-surface-400">Bs</span><input type="number" min="0" step="0.01" value={discountAmount} onChange={event => onDiscountChange(Math.max(0, Number(event.target.value) || 0))} className="w-20 border-0 bg-transparent px-2 py-1 text-right font-medium outline-none"/></span></label></section>
    <section className="border-t border-surface-200 py-4"><div className="space-y-1.5 text-sm"><div className="flex justify-between text-surface-600"><span>Subtotal</span><span>{money(subtotal)}</span></div>{productDiscount > 0 && <div className="flex justify-between text-surface-500"><span>Promociones</span><span>− {money(productDiscount)}</span></div>}{discountAmount > 0 && <div className="flex justify-between text-surface-500"><span>Descuento</span><span>− {money(discountAmount)}</span></div>}</div><div className="mt-4 flex items-end justify-between"><span className="text-xs font-bold uppercase tracking-[0.18em] text-surface-500">Total</span><span className="text-3xl font-black tracking-tight text-surface-950">{money(total)}</span></div></section>
  </>;
}

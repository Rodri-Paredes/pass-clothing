import { fmtMoneyRaw } from '../../lib/formatters';

export type PosPaymentType = 'EFECTIVO' | 'QR' | 'TARJETA' | 'MIXTO';
export interface PosMixedPayment { efectivo: number; qr: number; tarjeta: number; }

interface Props {
  value: PosPaymentType;
  onChange: (type: PosPaymentType) => void;
  mixedPayment: PosMixedPayment;
  onMixedPaymentChange: (details: PosMixedPayment) => void;
  total: number;
  cashReceived: number;
  onCashReceivedChange: (amount: number) => void;
}

const paymentTypes: PosPaymentType[] = ['EFECTIVO', 'QR', 'TARJETA', 'MIXTO'];
const money = (value: number) => `Bs ${fmtMoneyRaw(value)}`;

export default function PosPaymentSelector({ value, onChange, mixedPayment, onMixedPaymentChange, total, cashReceived, onCashReceivedChange }: Props) {
  const mixedTotal = mixedPayment.efectivo + mixedPayment.qr + mixedPayment.tarjeta;
  const remaining = total - mixedTotal;
  const change = Math.max(0, cashReceived - total);

  return <section className="border-t border-surface-200 py-4"><p className="mb-3 text-xs font-semibold uppercase tracking-wider text-surface-500">Método de pago</p><div className="grid grid-cols-4 gap-1">{paymentTypes.map(type => <button key={type} type="button" onClick={() => onChange(type)} className={`px-1 py-2.5 text-[11px] font-bold transition ${value === type ? 'bg-surface-950 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'}`}>{type}</button>)}</div>
    {value === 'EFECTIVO' && <div className="mt-3 grid grid-cols-2 gap-3"><label className="text-xs text-surface-500">Recibido<input type="number" min="0" value={cashReceived || ''} onChange={event => onCashReceivedChange(Number(event.target.value) || 0)} className="mt-1 w-full border-b border-surface-300 px-0 py-2 text-sm outline-none focus:border-surface-950"/></label><div className="text-xs text-surface-500">Cambio<p className="mt-1 py-2 text-sm font-bold text-surface-950">{money(change)}</p></div></div>}
    {value === 'MIXTO' && <div className="mt-3 grid grid-cols-3 gap-2">{(['efectivo','qr','tarjeta'] as const).map(key => <label key={key} className="text-[11px] capitalize text-surface-500">{key}<input type="number" min="0" value={mixedPayment[key] || ''} onChange={event => onMixedPaymentChange({ ...mixedPayment, [key]: Number(event.target.value) || 0 })} className="mt-1 w-full border-b border-surface-300 px-0 py-2 text-sm outline-none focus:border-surface-950"/></label>)}<p className={`col-span-3 text-right text-xs font-semibold ${Math.abs(remaining) <= .01 ? 'text-emerald-600' : 'text-amber-700'}`}>{remaining > 0 ? `Restante: ${money(remaining)}` : remaining < 0 ? `Excede: ${money(Math.abs(remaining))}` : 'Monto completo'}</p></div>}
  </section>;
}

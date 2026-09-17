import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import Button from '../ui/Button';
import CustomerSelector from '../customers/CustomerSelector';
import type { Customer } from '../../lib/types';
import { fmtMoneyRaw } from '../../lib/formatters';
import PosCart, { type PosCartItem } from './PosCart';
import PosPaymentSelector, { type PosMixedPayment, type PosPaymentType } from './PosPaymentSelector';
import PosSaleSummary from './PosSaleSummary';

export type { PosCartItem } from './PosCart';
export type { PosPaymentType } from './PosPaymentSelector';

interface Props {
  cart: PosCartItem[];
  customer: Customer | null;
  onCustomerChange: (customer: Customer | null) => void;
  onCreateCustomer: () => void;
  onQuantityChange: (productId: string, variantId: string, quantity: number) => void;
  onRemove: (productId: string, variantId: string) => void;
  discountAmount: number;
  onDiscountChange: (amount: number) => void;
  productDiscount: number;
  subtotal: number;
  total: number;
  paymentType: PosPaymentType;
  onPaymentTypeChange: (type: PosPaymentType) => void;
  mixedPayment: PosMixedPayment;
  onMixedPaymentChange: (details: PosMixedPayment) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
  channel: 'TIENDA' | 'WEB';
  onChannelChange: (channel: 'TIENDA' | 'WEB') => void;
  isProcessing: boolean;
  onCheckout: () => void;
  onClear: () => void;
}

const money = (value: number) => `Bs ${fmtMoneyRaw(value)}`;

export default function PosCheckoutPanel(props: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cashReceived, setCashReceived] = useState(0);
  const itemCount = props.cart.reduce((sum, item) => sum + item.quantity, 0);
  const mixedTotal = props.mixedPayment.efectivo + props.mixedPayment.qr + props.mixedPayment.tarjeta;
  const mixedRemaining = props.total - mixedTotal;
  const checkoutDisabled = props.cart.length === 0 || props.isProcessing || (props.paymentType === 'MIXTO' && Math.abs(mixedRemaining) > 0.01);

  useEffect(() => {
    if (props.cart.length === 0) {
      setCashReceived(0);
      setMobileOpen(false);
    }
  }, [props.cart.length]);

  const panel = <div className="flex h-full flex-col bg-white">
    <header className="flex items-center justify-between border-b border-surface-200 px-5 py-4">
      <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-surface-500">Venta actual</p><p className="mt-1 text-sm text-surface-600">{itemCount} {itemCount === 1 ? 'unidad' : 'unidades'}</p></div>
      <button type="button" onClick={() => setMobileOpen(false)} className="p-2 text-surface-500 xl:hidden" aria-label="Cerrar venta"><X className="h-5 w-5"/></button>
    </header>
    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
      <section className="pb-4"><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-surface-500">Cliente</p><CustomerSelector value={props.customer} onChange={props.onCustomerChange} onCreate={props.onCreateCustomer}/></section>
      <PosCart items={props.cart} onQuantityChange={props.onQuantityChange} onRemove={props.onRemove}/>
      {props.cart.length > 0 && <>
        <PosSaleSummary discountAmount={props.discountAmount} onDiscountChange={props.onDiscountChange} productDiscount={props.productDiscount} subtotal={props.subtotal} total={props.total}/>
        <PosPaymentSelector value={props.paymentType} onChange={props.onPaymentTypeChange} mixedPayment={props.mixedPayment} onMixedPaymentChange={props.onMixedPaymentChange} total={props.total} cashReceived={cashReceived} onCashReceivedChange={setCashReceived}/>
        <details open className="border-t border-surface-200 py-3 text-sm"><summary className="cursor-pointer text-surface-600">Detalles de la venta</summary><div className="mt-3 grid grid-cols-2 gap-3"><select value={props.channel} onChange={event => props.onChannelChange(event.target.value as 'TIENDA' | 'WEB')} className="border border-surface-300 p-2 text-sm"><option value="TIENDA">Tienda</option><option value="WEB">Web</option></select><input value={props.notes} onChange={event => props.onNotesChange(event.target.value)} placeholder="Nota opcional" maxLength={200} className="border border-surface-300 p-2 text-sm"/></div></details>
      </>}
    </div>
    {props.cart.length > 0 && <footer className="border-t border-surface-200 bg-white p-4"><Button onClick={props.onCheckout} isLoading={props.isProcessing} disabled={checkoutDisabled} className="h-14 w-full rounded-none bg-surface-950 text-base font-bold hover:bg-brand-700">{props.isProcessing ? 'Procesando…' : `COBRAR · ${money(props.total)}`}</Button><button type="button" onClick={props.onClear} className="mt-2 w-full py-1.5 text-xs text-surface-500 hover:text-red-600">Limpiar venta</button></footer>}
  </div>;

  return <>
    <aside className="hidden h-[calc(100vh-2rem)] overflow-hidden border border-surface-200 bg-white xl:sticky xl:top-4 xl:block">{panel}</aside>
    {props.cart.length > 0 && <button type="button" onClick={() => setMobileOpen(true)} className="fixed inset-x-4 bottom-4 z-30 flex items-center justify-between bg-surface-950 px-5 py-4 text-white shadow-2xl xl:hidden"><span className="text-sm font-semibold">VER VENTA · {itemCount} ITEMS</span><span className="font-bold">{money(props.total)}</span></button>}
    {mobileOpen && <div className="fixed inset-0 z-50 xl:hidden"><button type="button" aria-label="Cerrar" onClick={() => setMobileOpen(false)} className="absolute inset-0 bg-black/50"/><div className="absolute inset-x-0 bottom-0 h-[92vh] overflow-hidden bg-white shadow-2xl sm:inset-y-0 sm:left-auto sm:h-auto sm:w-[430px]">{panel}</div></div>}
  </>;
}

import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { fmtMoneyRaw } from '../../lib/formatters';

export interface PosCartItem {
  product: {
    id: string;
    name: string;
    price: number;
    variant_id: string;
    size?: string;
    image_url?: string;
    finalPrice?: number;
    originalPrice?: number;
  };
  quantity: number;
  availableStock: number;
}

interface Props {
  items: PosCartItem[];
  onQuantityChange: (productId: string, variantId: string, quantity: number) => void;
  onRemove: (productId: string, variantId: string) => void;
}

const money = (value: number) => `Bs ${fmtMoneyRaw(value)}`;

export default function PosCart({ items, onQuantityChange, onRemove }: Props) {
  if (items.length === 0) return <div className="flex min-h-56 flex-col items-center justify-center border-y border-surface-100 py-10 text-center"><ShoppingBag className="h-8 w-8 text-surface-300"/><p className="mt-4 font-semibold text-surface-800">Todavía no agregaste productos</p><p className="mt-1 max-w-56 text-sm text-surface-500">Selecciona una talla para comenzar la venta.</p></div>;

  return <section className="border-t border-surface-200 py-4"><div className="space-y-4">{items.map(item => {
    const price = item.product.finalPrice || item.product.price;
    return <div key={`${item.product.id}-${item.product.variant_id}`} className="grid grid-cols-[44px_minmax(0,1fr)_auto] gap-3">
      <div className="h-11 w-11 overflow-hidden bg-surface-100">{item.product.image_url ? <img src={item.product.image_url} alt="" className="h-full w-full object-cover"/> : <ShoppingBag className="m-3 h-5 w-5 text-surface-400"/>}</div>
      <div className="min-w-0"><p className="truncate text-sm font-semibold text-surface-950">{item.product.name}</p><p className="text-xs text-surface-500">Talla {item.product.size || '—'} · {money(price)} c/u</p><div className="mt-2 flex items-center gap-1"><button type="button" onClick={() => onQuantityChange(item.product.id, item.product.variant_id, item.quantity - 1)} className="h-7 w-7 border border-surface-300 text-surface-700"><Minus className="m-auto h-3.5 w-3.5"/></button><span className="w-8 text-center text-sm font-semibold">{item.quantity}</span><button type="button" disabled={item.quantity >= item.availableStock} onClick={() => onQuantityChange(item.product.id, item.product.variant_id, item.quantity + 1)} className="h-7 w-7 border border-surface-300 text-surface-700 disabled:opacity-30"><Plus className="m-auto h-3.5 w-3.5"/></button><button type="button" onClick={() => onRemove(item.product.id, item.product.variant_id)} className="ml-2 p-1 text-surface-400 hover:text-red-600" aria-label="Eliminar"><Trash2 className="h-4 w-4"/></button></div></div>
      <p className="text-sm font-semibold text-surface-950">{money(item.quantity * price)}</p>
    </div>;
  })}</div></section>;
}

import { Package } from 'lucide-react';
import { fmtMoneyRaw } from '../../lib/formatters';

type Stock = { variant_id: string; quantity: number };
type Product = { id: string; name: string; price: number; category: string; image_url?: string; variants?: Array<{ id: string; size: string }> };
interface Props { products: Product[]; stock: Stock[]; onAdd: (product: Product & { variant_id: string; size: string }) => void; cartQuantity: (productId: string, variantId: string) => number; getDisplayPrice?: (productId: string, price: number) => number; }

export default function PosProductGrid({ products, stock, onAdd, cartQuantity, getDisplayPrice }: Props) {
  return <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 sm:gap-x-4 xl:grid-cols-3 2xl:grid-cols-4">
    {products.map(product => {
      const variants = (product.variants || []).map(variant => ({ ...variant, stock: stock.find(row => row.variant_id === variant.id)?.quantity || 0 }));
      if (!variants.some(variant => variant.stock > 0)) return null;
      const displayPrice = getDisplayPrice?.(product.id, product.price) ?? product.price;
      return <article key={product.id} className="group min-w-0"><div className="aspect-[4/5] overflow-hidden bg-surface-100"><>{product.image_url ? <img src={product.image_url} alt={product.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"/> : <Package className="m-auto h-full w-10 text-surface-400"/>}</></div><div className="pt-3"><p className="truncate text-sm font-semibold text-surface-950">{product.name}</p><p className="mt-0.5 text-xs text-surface-500">{product.category}</p><p className="mt-2 text-sm font-semibold">{displayPrice < product.price && <span className="mr-2 text-xs font-normal text-surface-400 line-through">Bs {fmtMoneyRaw(product.price)}</span>}<span className={displayPrice < product.price ? 'text-emerald-700' : ''}>Bs {fmtMoneyRaw(displayPrice)}</span></p><div className="mt-3 flex flex-wrap gap-1.5">{variants.map(variant => <button key={variant.id} type="button" disabled={!variant.stock} onClick={() => onAdd({ ...product, variant_id: variant.id, size: variant.size })} className={`min-w-9 px-2 py-1.5 text-xs font-semibold transition ${variant.stock ? 'bg-surface-950 text-white hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500' : 'cursor-not-allowed bg-surface-100 text-surface-400 line-through'}`}>{variant.size}{cartQuantity(product.id, variant.id) ? ` · ${cartQuantity(product.id, variant.id)}` : ''}</button>)}</div></div></article>;
    })}
  </div>;
}

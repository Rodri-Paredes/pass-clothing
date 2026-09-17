import { useMemo, useState } from 'react';
import { Package, ShoppingBag } from 'lucide-react';
import Modal from '../ui/Modal';
import { fmtMoneyRaw } from '../../lib/formatters';

type Stock = { variant_id: string; quantity: number };
type Product = { id: string; name: string; price: number; category: string; image_url?: string; variants?: Array<{ id: string; size: string }> };
type ProductWithVariant = Product & { variant_id: string; size: string };

interface Props {
  products: Product[];
  stock: Stock[];
  onAdd: (product: ProductWithVariant) => void;
  cartQuantity: (productId: string, variantId: string) => number;
  getDisplayPrice?: (productId: string, price: number) => number;
}

export default function PosProductGrid({ products, stock, onAdd, cartQuantity, getDisplayPrice }: Props) {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const selectedVariants = useMemo(() => {
    if (!selectedProduct) return [];
    return (selectedProduct.variants || []).map(variant => {
      const quantity = stock.find(row => row.variant_id === variant.id)?.quantity || 0;
      const inCart = cartQuantity(selectedProduct.id, variant.id);
      return { ...variant, quantity, inCart, remaining: Math.max(0, quantity - inCart) };
    });
  }, [selectedProduct, stock, cartQuantity]);

  const addSize = (variant: (typeof selectedVariants)[number]) => {
    if (!selectedProduct || variant.remaining <= 0) return;
    onAdd({ ...selectedProduct, variant_id: variant.id, size: variant.size });
    setSelectedProduct(null);
  };

  return <>
    <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 sm:gap-x-4 xl:grid-cols-3 2xl:grid-cols-4">
      {products.map(product => {
        const variants = (product.variants || []).map(variant => {
          const quantity = stock.find(row => row.variant_id === variant.id)?.quantity || 0;
          const inCart = cartQuantity(product.id, variant.id);
          return { ...variant, quantity, inCart, remaining: Math.max(0, quantity - inCart) };
        });
        if (!variants.some(variant => variant.quantity > 0)) return null;
        const displayPrice = getDisplayPrice?.(product.id, product.price) ?? product.price;
        const totalRemaining = variants.reduce((sum, variant) => sum + variant.remaining, 0);

        return <article key={product.id} className="group min-w-0">
          <button type="button" onClick={() => setSelectedProduct(product)} className="block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2" aria-label={`Seleccionar talla de ${product.name}`}>
            <div className="relative aspect-[4/5] overflow-hidden bg-surface-100">{product.image_url ? <img src={product.image_url} alt={product.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"/> : <Package className="m-auto h-full w-10 text-surface-400"/>}<span className="absolute inset-x-3 bottom-3 bg-white/95 px-3 py-2 text-center text-xs font-bold text-surface-950 opacity-0 shadow-sm transition group-hover:opacity-100 group-focus-within:opacity-100">Elegir talla</span></div>
            <div className="pt-3"><p className="truncate text-sm font-semibold text-surface-950">{product.name}</p><p className="mt-0.5 text-xs text-surface-500">{product.category}</p><p className="mt-2 text-sm font-semibold">{displayPrice < product.price && <span className="mr-2 text-xs font-normal text-surface-400 line-through">Bs {fmtMoneyRaw(product.price)}</span>}<span className={displayPrice < product.price ? 'text-emerald-700' : ''}>Bs {fmtMoneyRaw(displayPrice)}</span></p>
              <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Stock disponible por talla">{variants.map(variant => <span key={variant.id} className={`px-2 py-1 text-[11px] font-semibold ${variant.remaining > 0 ? 'bg-surface-100 text-surface-700' : 'bg-surface-50 text-surface-400 line-through'}`}>{variant.size}: {variant.remaining}</span>)}</div>
              <div className="mt-2 flex items-center justify-between text-xs"><span className={totalRemaining > 0 ? 'font-medium text-emerald-700' : 'text-red-600'}>{totalRemaining} {totalRemaining === 1 ? 'prenda disponible' : 'prendas disponibles'}</span><span className="font-semibold text-brand-700">Seleccionar →</span></div>
            </div>
          </button>
        </article>;
      })}
    </div>

    <Modal isOpen={Boolean(selectedProduct)} onClose={() => setSelectedProduct(null)} title="Selecciona una talla" description={selectedProduct?.name} size="sm">
      {selectedProduct && <div className="p-5"><div className="mb-5 flex items-center gap-4"><div className="h-20 w-16 shrink-0 overflow-hidden bg-surface-100">{selectedProduct.image_url ? <img src={selectedProduct.image_url} alt="" className="h-full w-full object-cover"/> : <Package className="m-auto h-full w-7 text-surface-400"/>}</div><div><p className="text-xs uppercase tracking-wider text-surface-500">Precio</p><p className="mt-1 text-xl font-bold text-surface-950">Bs {fmtMoneyRaw(getDisplayPrice?.(selectedProduct.id, selectedProduct.price) ?? selectedProduct.price)}</p><p className="mt-1 text-xs text-surface-500">Elige la talla para agregarla a la venta.</p></div></div><div className="space-y-2">{selectedVariants.map(variant => <button key={variant.id} type="button" disabled={variant.remaining <= 0} onClick={() => addSize(variant)} className="flex w-full items-center justify-between border border-surface-200 px-4 py-3 text-left transition hover:border-surface-950 hover:bg-surface-50 disabled:cursor-not-allowed disabled:bg-surface-50 disabled:opacity-50"><span><span className="block text-base font-bold text-surface-950">Talla {variant.size}</span><span className={`text-xs ${variant.remaining > 0 ? 'text-emerald-700' : 'text-red-600'}`}>{variant.remaining > 0 ? `Quedan ${variant.remaining}` : 'Sin stock'}{variant.inCart > 0 ? ` · ${variant.inCart} en la venta` : ''}</span></span>{variant.remaining > 0 ? <span className="flex items-center gap-1.5 text-xs font-bold text-brand-700"><ShoppingBag className="h-4 w-4"/>Agregar</span> : <span className="text-xs font-semibold text-surface-400">Agotado</span>}</button>)}</div></div>}
    </Modal>
  </>;
}

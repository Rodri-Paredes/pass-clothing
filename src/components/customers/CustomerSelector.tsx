import React, { useEffect, useState } from 'react';
import { Search, UserRound, X } from 'lucide-react';
import Input from '../ui/Input';
import type { Customer } from '../../lib/types';
import { customerService } from '../../services/customerService';

interface Props { value: Customer | null; onChange: (customer: Customer | null) => void; onCreate?: () => void; }

const customerName = (customer: Customer) => customer.full_name || [customer.first_name, customer.last_name].filter(Boolean).join(' ') || 'Sin nombre';

export default function CustomerSelector({ value, onChange, onCreate }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2 || value) { setResults([]); return; }
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try { setResults(await customerService.search(term)); setOpen(true); }
      catch { setResults([]); }
      finally { setLoading(false); }
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [query, value]);

  if (value) return (
    <div className="flex items-center justify-between gap-3 bg-surface-50 px-3 py-2.5">
      <div className="min-w-0 flex items-center gap-2"><UserRound className="h-4 w-4 shrink-0 text-brand-600" /><div className="min-w-0"><p className="truncate text-sm font-semibold text-surface-900">{customerName(value)}</p><p className="truncate text-xs text-surface-500">{value.ci ? `CI ${value.ci} · ` : ''}{value.phone || 'Sin teléfono'}</p></div></div>
      <div className="flex shrink-0 items-center gap-1"><button type="button" onClick={() => { onChange(null); setSearching(true); }} className="px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50">Cambiar</button><button type="button" onClick={() => { onChange(null); setSearching(false); }} className="p-1 text-surface-500 hover:bg-surface-100" aria-label="Quitar cliente"><X className="h-4 w-4" /></button></div>
    </div>
  );

  return <div className="relative">
    {!searching ? <div className="flex items-center justify-between gap-3 bg-surface-50 px-3 py-2.5"><span className="text-sm text-surface-600">Venta sin cliente</span><div className="flex shrink-0 gap-1"><button type="button" onClick={() => setSearching(true)} className="px-2 py-1 text-xs font-semibold text-surface-800 hover:bg-white"><Search className="mr-1 inline h-3.5 w-3.5"/>Buscar</button>{onCreate && <button type="button" onClick={onCreate} className="bg-surface-950 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-700">+ Nuevo</button>}</div></div> : <div className="flex items-center gap-1"><div className="min-w-0 flex-1"><Input value={query} onChange={(e) => setQuery(e.target.value)} onFocus={() => results.length && setOpen(true)} placeholder="CI, teléfono, email o nombre" prefix={<Search className="h-4 w-4" />} autoFocus /></div><button type="button" onClick={() => { setSearching(false); setQuery(''); setOpen(false); }} className="p-2 text-surface-500 hover:bg-surface-100" aria-label="Cerrar búsqueda"><X className="h-4 w-4"/></button></div>}
    {open && (results.length > 0 || loading) && <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-surface-200 bg-white py-1 shadow-lg">
      {loading && <p className="px-3 py-2 text-sm text-surface-500">Buscando…</p>}
      {!loading && results.map((customer) => <button type="button" key={customer.id} onClick={() => { onChange(customer); setQuery(''); setOpen(false); }} className="block w-full px-3 py-2 text-left hover:bg-surface-50"><p className="text-sm font-medium">{customerName(customer)} <span className="text-surface-500">{customer.customer_code}</span></p><p className="text-xs text-surface-500">{customer.ci ? `CI ${customer.ci} · ` : ''}{customer.phone || 'Sin teléfono'}{customer.email ? ` · ${customer.email}` : ''}</p></button>)}
    </div>}
  </div>;
}

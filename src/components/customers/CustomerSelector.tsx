import React, { useEffect, useState } from 'react';
import { Search, UserRound, X } from 'lucide-react';
import Input from '../ui/Input';
import type { Customer } from '../../lib/types';
import { customerService } from '../../services/customerService';

interface Props { value: Customer | null; onChange: (customer: Customer | null) => void; }

const customerName = (customer: Customer) => customer.full_name || [customer.first_name, customer.last_name].filter(Boolean).join(' ') || 'Sin nombre';

export default function CustomerSelector({ value, onChange }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

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
    <div className="flex items-center justify-between gap-3 rounded-lg border border-brand-200 bg-brand-50 p-3">
      <div className="min-w-0 flex items-center gap-2"><UserRound className="h-4 w-4 text-brand-600" /><div className="min-w-0"><p className="truncate text-sm font-semibold text-surface-900">{customerName(value)}</p><p className="text-xs text-surface-600">{value.customer_code}{value.phone ? ` · ${value.phone}` : ''}</p></div></div>
      <button type="button" onClick={() => onChange(null)} className="rounded p-1 text-surface-500 hover:bg-brand-100" aria-label="Quitar cliente"><X className="h-4 w-4" /></button>
    </div>
  );

  return <div className="relative">
    <Input value={query} onChange={(e) => setQuery(e.target.value)} onFocus={() => results.length && setOpen(true)} placeholder="Cliente opcional: nombre, teléfono o código" prefix={<Search className="h-4 w-4" />} />
    {open && (results.length > 0 || loading) && <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-surface-200 bg-white py-1 shadow-lg">
      {loading && <p className="px-3 py-2 text-sm text-surface-500">Buscando…</p>}
      {!loading && results.map((customer) => <button type="button" key={customer.id} onClick={() => { onChange(customer); setQuery(''); setOpen(false); }} className="block w-full px-3 py-2 text-left hover:bg-surface-50"><p className="text-sm font-medium">{customerName(customer)} <span className="text-surface-500">{customer.customer_code}</span></p><p className="text-xs text-surface-500">{customer.phone || 'Sin teléfono'}</p></button>)}
    </div>}
  </div>;
}

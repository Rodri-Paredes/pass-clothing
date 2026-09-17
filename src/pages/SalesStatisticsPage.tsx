import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { salesStatisticsService } from '../services/salesStatisticsService';
import { useAuthStore } from '../store/authStore';
import type { SalesChannelBreakdown, SalesUnitsBreakdown } from '../lib/types';

type Period = 'today' | 'week' | 'month' | 'custom';
type Dimension = 'category' | 'size' | 'color' | 'fit' | 'style';
type Breakdown = Record<Dimension, SalesUnitsBreakdown[]>;

const dimensions: Array<{ key: Dimension; title: string }> = [
  { key: 'category', title: 'Unidades por categoría' }, { key: 'size', title: 'Unidades por talla' },
  { key: 'color', title: 'Unidades por color' }, { key: 'fit', title: 'Unidades por fit' }, { key: 'style', title: 'Unidades por tipo / estilo' },
];
const emptyBreakdown: Breakdown = { category: [], size: [], color: [], fit: [], style: [] };
const boliviaDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const rangeFor = (period: Period, start: string, end: string) => {
  const today = boliviaDate(); if (period === 'custom') return { start, end };
  const d = new Date(`${today}T12:00:00-04:00`); let first = new Date(d); let last = new Date(d);
  if (period === 'week') { first.setDate(d.getDate() - ((d.getDay() + 6) % 7)); last.setDate(first.getDate() + 7); }
  else if (period === 'month') { first = new Date(d.getFullYear(), d.getMonth(), 1); last = new Date(d.getFullYear(), d.getMonth() + 1, 1); }
  else last.setDate(d.getDate() + 1);
  const day = (date: Date) => date.toISOString().slice(0, 10); return { start: day(first), end: day(last) };
};
const instant = (date: string) => `${date}T00:00:00-04:00`;

export default function SalesStatisticsPage() {
  const { activeBranch, branches } = useAuthStore();
  const [period, setPeriod] = useState<Period>('month'); const [start, setStart] = useState(boliviaDate()); const [end, setEnd] = useState(boliviaDate());
  const [branchId, setBranchId] = useState(activeBranch?.id || ''); const [topN, setTopN] = useState(5);
  const [breakdowns, setBreakdowns] = useState<Breakdown>(emptyBreakdown); const [error, setError] = useState('');
  const [channels, setChannels] = useState<SalesChannelBreakdown[]>([]);
  const range = useMemo(() => rangeFor(period, start, end), [period, start, end]);
  const load = useCallback(async () => {
    setError('');
    try {
      const [rows, channelRows] = await Promise.all([Promise.all(dimensions.map(({ key }) => salesStatisticsService.unitsBreakdown(key, instant(range.start), instant(range.end), branchId || undefined, topN))), salesStatisticsService.channelBreakdown(instant(range.start), instant(range.end), branchId || undefined)]);
      setBreakdowns(Object.fromEntries(dimensions.map(({ key }, index) => [key, rows[index]])) as Breakdown);
      setChannels(channelRows);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'No se pudieron cargar las estadísticas'); }
  }, [branchId, range.end, range.start, topN]);
  useEffect(() => { if (!branchId && activeBranch) setBranchId(activeBranch.id); }, [activeBranch, branchId]);
  useEffect(() => { if (range.start && range.end) void load(); }, [load, range.end, range.start]);
  const table = (title: string, rows: SalesUnitsBreakdown[]) => <Card><h2 className="mb-4 text-lg font-semibold">{title}</h2><div className="space-y-3">{rows.map(r => <div key={r.label}><div className="mb-1 flex justify-between text-sm"><span>{r.label}</span><span className="font-medium">{r.units} unidades · {r.percentage.toFixed(2)}%</span></div><div className="h-2 overflow-hidden rounded bg-surface-100"><div className="h-full rounded bg-brand-500" style={{ width: `${Math.min(r.percentage, 100)}%` }}/></div></div>)}{!rows.length && <p className="text-sm text-surface-500">Sin ventas en el rango.</p>}</div></Card>;
  const channelCard = <Card><h2 className="mb-4 text-lg font-semibold">Canal de venta</h2><div className="space-y-3">{channels.map(row => <div key={row.channel} className="rounded-lg bg-surface-50 p-3"><div className="flex justify-between font-semibold"><span>{row.channel}</span><span>{row.sales_count} ventas · {row.sales_percentage.toFixed(2)}%</span></div><div className="mt-1 grid grid-cols-2 gap-2 text-sm text-surface-600"><span>{row.units} unidades · {row.units_percentage.toFixed(2)}%</span><span className="text-right">Bs {row.revenue.toFixed(2)} · {row.revenue_percentage.toFixed(2)}%</span></div></div>)}{!channels.length && <p className="text-sm text-surface-500">Sin ventas en el rango.</p>}</div></Card>;
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold">Estadísticas de ventas</h1><p className="text-sm text-surface-500">Unidades vendidas, calculadas en PostgreSQL con zona horaria de Bolivia.</p></div><Card><div className="flex flex-wrap gap-3"><select value={period} onChange={e => setPeriod(e.target.value as Period)} className="rounded-lg border p-2 text-sm"><option value="today">Hoy</option><option value="week">Semana</option><option value="month">Mes</option><option value="custom">Rango personalizado</option></select>{period === 'custom' && <><input type="date" value={start} onChange={e => setStart(e.target.value)} className="rounded-lg border p-2 text-sm"/><input type="date" value={end} onChange={e => setEnd(e.target.value)} className="rounded-lg border p-2 text-sm"/></>}<select value={branchId} onChange={e => setBranchId(e.target.value)} className="rounded-lg border p-2 text-sm"><option value="">Todas las sucursales</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select><label className="flex items-center gap-2 text-sm">Top <input type="number" min="1" max="100" value={topN} onChange={e => setTopN(Number(e.target.value) || 1)} className="w-16 rounded-lg border p-2"/></label><Button variant="outline" onClick={load}>Actualizar</Button></div>{error && <p className="mt-3 text-sm text-red-600">{error}</p>}</Card>{channelCard}<div className="grid gap-6 lg:grid-cols-2">{dimensions.map(({ key, title }) => <React.Fragment key={key}>{table(title, breakdowns[key])}</React.Fragment>)}</div></div>;
}

import { useCallback, useEffect, useState } from 'react';
import { Check, Clock3, Crown, ExternalLink, Settings2, Users, X } from 'lucide-react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import { crewService } from '../services/crewService';
import type { CrewBenefitDefinition, CrewBenefitType, CrewMembership, CrewMembershipRequest, CrewPlan } from '../lib/types';
import { fmtMoneyRaw } from '../lib/formatters';

type Tab = 'dashboard' | 'requests' | 'members' | 'benefits' | 'links' | 'settings';
type Assignment = { plan_id: string; benefit_id: string };
type BenefitDraft = {
  code: string; name: string; description: string; benefit_type: CrewBenefitType;
  value: string; targets: string; planIds: string[];
};

const emptyBenefit: BenefitDraft = { code: '', name: '', description: '', benefit_type: 'percentage_discount', value: '', targets: '', planIds: [] };
const date = (value?: string | null) => value ? new Date(value).toLocaleDateString('es-BO', { timeZone: 'America/La_Paz' }) : '—';
const customerName = (row: { customer?: { customer_code?: string | null; full_name?: string | null; first_name?: string | null; last_name?: string | null } }) => {
  const name = row.customer?.full_name || [row.customer?.first_name, row.customer?.last_name].filter(Boolean).join(' ') || 'Cliente';
  return row.customer?.customer_code ? `${name} · ${row.customer.customer_code}` : name;
};

export default function PassCrewPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [stats, setStats] = useState({ active_members: 0, pending_requests: 0, expiring_30_days: 0, confirmed_revenue: 0 });
  const [requests, setRequests] = useState<CrewMembershipRequest[]>([]);
  const [members, setMembers] = useState<CrewMembership[]>([]);
  const [linkRequests, setLinkRequests] = useState<import('../lib/types').CustomerAccountLinkRequest[]>([]);
  const [plans, setPlans] = useState<CrewPlan[]>([]);
  const [definitions, setDefinitions] = useState<CrewBenefitDefinition[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [settings, setSettings] = useState<{ payment_instructions?: string | null; payment_qr_path?: string | null }>({});
  const [benefit, setBenefit] = useState<BenefitDraft>(emptyBenefit);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setBusy(true); setError('');
    try {
      const [dashboard, requestRows, memberRows, linkRows, planRows, settingRow, benefitData] = await Promise.all([
        crewService.dashboard(), crewService.requests(), crewService.memberships(), crewService.accountLinkRequests(), crewService.plans(), crewService.settings(), crewService.benefits(),
      ]);
      setStats(dashboard); setRequests(requestRows); setMembers(memberRows); setLinkRequests(linkRows); setPlans(planRows); setSettings(settingRow || {});
      setDefinitions(benefitData.definitions); setAssignments(benefitData.assignments as Assignment[]);
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar PASS Crew'); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (action: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await action(); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo completar la acción'); setBusy(false); }
  };
  const openReceipt = async (path?: string | null) => { if (!path) return; const url = await crewService.receiptUrl(path); if (url) window.open(url, '_blank', 'noopener,noreferrer'); };
  const planIdsFor = (benefitId: string) => assignments.filter(row => row.benefit_id === benefitId).map(row => row.plan_id);

  const createBenefit = () => act(async () => {
    const value = Number(benefit.value);
    if (!benefit.code.trim() || !benefit.name.trim() || !Number.isFinite(value) || value <= 0 || benefit.planIds.length === 0) throw new Error('Completa código, nombre, valor y al menos un plan');
    const targets = benefit.targets.split(',').map(item => item.trim()).filter(Boolean);
    const rule: Record<string, unknown> = { value };
    if (benefit.benefit_type === 'product_discount') rule.product_ids = targets;
    if (benefit.benefit_type === 'category_discount') rule.categories = targets;
    if (benefit.benefit_type === 'drop_discount') rule.drop_ids = targets;
    if (['product_discount', 'category_discount', 'drop_discount'].includes(benefit.benefit_type) && targets.length === 0) throw new Error('Este tipo requiere objetivos separados por coma');
    await crewService.createBenefit({ code: benefit.code.trim().toUpperCase(), name: benefit.name.trim(), description: benefit.description.trim() || null, benefit_type: benefit.benefit_type, rule, is_active: true, is_public: true }, benefit.planIds);
    setBenefit(emptyBenefit);
  });

  return <div className="space-y-6">
    <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-brand-600">Membresías</p><h1 className="text-3xl font-bold text-surface-950">PASS Crew</h1><p className="text-sm text-surface-500">Solicitudes, miembros, planes y beneficios configurables.</p></div>
    <div className="flex gap-1 overflow-x-auto border-b border-surface-200">{(['dashboard','requests','members','benefits','links','settings'] as Tab[]).map(key => <button key={key} onClick={() => setTab(key)} className={`px-4 py-3 text-sm font-semibold ${tab === key ? 'border-b-2 border-brand-600 text-brand-700' : 'text-surface-500'}`}>{{ dashboard:'Dashboard', requests:'Solicitudes', members:'Miembros', benefits:'Beneficios', links:'Vinculaciones web', settings:'Configuración' }[key]}</button>)}</div>
    {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

    {tab === 'dashboard' && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
      ['Miembros activos', stats.active_members, Crown], ['Solicitudes pendientes', stats.pending_requests, Clock3], ['Vencen en 30 días', stats.expiring_30_days, Users], ['Ingresos confirmados', `Bs ${fmtMoneyRaw(stats.confirmed_revenue)}`, Check],
    ].map(([label,value,Icon]) => <Card key={String(label)}><div className="flex items-start justify-between p-5"><div><p className="text-sm text-surface-500">{String(label)}</p><p className="mt-2 text-2xl font-bold text-surface-950">{String(value)}</p></div><Icon className="h-5 w-5 text-brand-600"/></div></Card>)}</div>}

    {tab === 'requests' && <Card><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="border-b text-left text-surface-500">{['Solicitud','Cliente','Plan','Precio','Enviada','Comprobante','Estado','Acciones'].map(h => <th className="px-4 py-3" key={h}>{h}</th>)}</tr></thead><tbody>{requests.map(row => <tr key={row.id} className="border-b last:border-0"><td className="px-4 py-3 font-mono text-xs">{row.request_number}</td><td className="px-4 py-3 font-medium">{customerName(row)}</td><td className="px-4 py-3">{row.plan_name_snapshot}</td><td className="px-4 py-3">Bs {fmtMoneyRaw(row.price_snapshot)}</td><td className="px-4 py-3">{date(row.submitted_at || row.created_at)}</td><td className="px-4 py-3"><button disabled={!row.receipt_path} onClick={() => openReceipt(row.receipt_path)} className="inline-flex items-center gap-1 text-brand-700 disabled:text-surface-300">Ver <ExternalLink className="h-3 w-3"/></button></td><td className="px-4 py-3 capitalize">{row.status}</td><td className="px-4 py-3">{row.status === 'pending' && <div className="flex gap-2"><Button size="sm" disabled={busy} onClick={() => act(() => crewService.approve(row.id))} icon={<Check className="h-3 w-3"/>}>Aprobar</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => { const reason = window.prompt('Motivo del rechazo (opcional)') ?? ''; act(() => crewService.reject(row.id, reason)); }} icon={<X className="h-3 w-3"/>}>Rechazar</Button></div>}</td></tr>)}</tbody></table></div></Card>}

    {tab === 'members' && <Card><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="border-b text-left text-surface-500">{['Miembro','Cliente','Plan','Inicio','Vencimiento','Estado'].map(h => <th className="px-4 py-3" key={h}>{h}</th>)}</tr></thead><tbody>{members.map(row => <tr key={row.id} className="border-b last:border-0"><td className="px-4 py-3 font-mono text-xs">{row.member_number}</td><td className="px-4 py-3 font-medium">{customerName(row)}</td><td className="px-4 py-3">{row.plan_name_snapshot}</td><td className="px-4 py-3">{date(row.started_at)}</td><td className="px-4 py-3">{date(row.expires_at)}</td><td className="px-4 py-3 capitalize">{row.status}</td></tr>)}</tbody></table></div></Card>}

    {tab === 'benefits' && <div className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]"><Card className="bg-surface-950 text-white"><div className="p-6"><p className="text-[10px] font-bold uppercase tracking-[.25em] text-brand-300">PASS Crew / Configuración</p><h2 className="mt-3 text-3xl font-black tracking-tight">Beneficios.</h2><p className="mt-3 text-sm leading-6 text-white/55">Define qué recibe cada plan, dónde aplica y si está visible para clientes. No se publican beneficios hasta asignarlos explícitamente.</p><div className="mt-8 space-y-3 text-sm text-white/65"><p>01 · Selecciona un tipo de beneficio.</p><p>02 · Define su alcance y regla.</p><p>03 · Asígnalo a Semestral, Anual o ambos.</p></div></div></Card><div className="space-y-5"><Card><div className="space-y-4 p-5"><div><h2 className="font-bold">Nuevo beneficio</h2><p className="mt-1 text-xs text-surface-500">Solo aparecerá en ecommerce si queda activo y público.</p></div><Input label="Código" value={benefit.code} onChange={e => setBenefit({...benefit,code:e.target.value})}/><Input label="Nombre" value={benefit.name} onChange={e => setBenefit({...benefit,name:e.target.value})}/><Input label="Descripción pública" value={benefit.description} onChange={e => setBenefit({...benefit,description:e.target.value})}/><select value={benefit.benefit_type} onChange={e => setBenefit({...benefit,benefit_type:e.target.value as CrewBenefitType,targets:''})} className="w-full border border-surface-300 p-2 text-sm"><option value="percentage_discount">Porcentaje</option><option value="fixed_discount">Monto fijo</option><option value="product_discount">Producto</option><option value="category_discount">Categoría</option><option value="drop_discount">Drop</option></select><Input label={benefit.benefit_type === 'fixed_discount' ? 'Monto Bs' : 'Valor de regla'} type="number" min="0" value={benefit.value} onChange={e => setBenefit({...benefit,value:e.target.value})}/>{['product_discount','category_discount','drop_discount'].includes(benefit.benefit_type) && <Input label="Alcance separado por coma" value={benefit.targets} onChange={e => setBenefit({...benefit,targets:e.target.value})}/>}<div className="flex flex-wrap gap-4">{plans.map(plan => <label key={plan.id} className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={benefit.planIds.includes(plan.id)} onChange={e => setBenefit({...benefit,planIds:e.target.checked ? [...benefit.planIds,plan.id] : benefit.planIds.filter(id => id !== plan.id)})}/>{plan.name}</label>)}</div><Button onClick={createBenefit}>Crear beneficio</Button></div></Card><Card><div className="p-5"><div className="mb-4 flex items-center justify-between"><h2 className="font-bold">Beneficios publicados</h2><span className="text-xs text-surface-500">{definitions.length} configurados</span></div><div className="divide-y">{definitions.length ? definitions.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-4 py-4"><div><p className="font-semibold">{item.name} <span className="ml-2 font-mono text-[10px] text-surface-400">{item.code}</span></p><p className="mt-1 text-xs text-surface-500">{item.benefit_type.replaceAll('_', ' ')} · {planIdsFor(item.id).map(id => plans.find(plan => plan.id === id)?.name).filter(Boolean).join(' / ') || 'Sin plan'} · {item.is_public ? 'Público' : 'Privado'}</p></div><Button size="sm" variant="outline" onClick={() => act(() => crewService.saveBenefit({...item,is_active:!item.is_active},planIdsFor(item.id)))}>{item.is_active ? 'Activo' : 'Inactivo'}</Button></div>) : <p className="py-8 text-sm text-surface-500">Todavía no hay beneficios configurados.</p>}</div></div></Card></div></div>}

    {tab === 'links' && <Card><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="border-b text-left text-surface-500">{['Cliente','Cuenta solicitante','Fecha','Acciones'].map(h => <th className="px-4 py-3" key={h}>{h}</th>)}</tr></thead><tbody>{linkRequests.map(row => <tr key={row.id} className="border-b last:border-0"><td className="px-4 py-3 font-medium">{customerName(row)}<span className="block text-xs font-normal text-surface-500">{row.customer?.phone || 'Sin teléfono'}</span></td><td className="px-4 py-3">{row.auth_email}</td><td className="px-4 py-3">{date(row.created_at)}</td><td className="px-4 py-3"><div className="flex gap-2"><Button size="sm" disabled={busy} onClick={() => act(() => crewService.approveAccountLink(row.id))}>Aprobar</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => { const reason = window.prompt('Motivo del rechazo (opcional)') ?? ''; act(() => crewService.rejectAccountLink(row.id, reason)); }}>Rechazar</Button></div></td></tr>)}</tbody></table>{linkRequests.length === 0 && <p className="p-6 text-sm text-surface-500">No hay solicitudes de vinculación pendientes.</p>}</div></Card>}

    {tab === 'settings' && <div className="grid gap-5 xl:grid-cols-2">
      <Card><div className="space-y-4 p-5"><div className="flex items-center gap-2"><Settings2 className="h-5 w-5"/><h2 className="font-bold">Planes y pago</h2></div>{plans.map((plan,index) => <div key={plan.id} className="grid grid-cols-2 gap-3 border-t pt-4 sm:grid-cols-4"><Input label="Nombre" value={plan.name} onChange={e => setPlans(rows => rows.map((p,i) => i === index ? {...p,name:e.target.value} : p))}/><Input label="Precio Bs" type="number" value={plan.price} onChange={e => setPlans(rows => rows.map((p,i) => i === index ? {...p,price:Number(e.target.value)} : p))}/><Input label="Meses" type="number" value={plan.duration_months} onChange={e => setPlans(rows => rows.map((p,i) => i === index ? {...p,duration_months:Number(e.target.value)} : p))}/><div className="flex items-end"><Button onClick={() => act(() => crewService.savePlan(plan))}>Guardar</Button></div><label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={plan.is_active} onChange={e => setPlans(rows => rows.map((p,i) => i === index ? {...p,is_active:e.target.checked} : p))}/> Plan activo</label></div>)}<textarea value={settings.payment_instructions || ''} onChange={e => setSettings({...settings,payment_instructions:e.target.value})} placeholder="Instrucciones de pago" className="min-h-24 w-full border border-surface-300 p-3 text-sm"/><label className="block text-xs font-medium text-surface-600">QR privado<input className="mt-2 block w-full" type="file" accept="image/png,image/jpeg,image/webp" onChange={async e => { const file=e.target.files?.[0]; if(file) setSettings({...settings,payment_qr_path:await crewService.uploadQr(file)}); }}/></label><Button onClick={() => act(() => crewService.saveSettings(settings.payment_instructions || null, settings.payment_qr_path || null))}>Guardar pago</Button></div></Card>
      <div className="space-y-5"><Card><div className="space-y-4 p-5"><h2 className="font-bold">Nuevo beneficio</h2><p className="text-xs text-surface-500">No se crea ningún beneficio hasta configurarlo y asignarlo explícitamente.</p><Input label="Código" value={benefit.code} onChange={e => setBenefit({...benefit,code:e.target.value})}/><Input label="Nombre" value={benefit.name} onChange={e => setBenefit({...benefit,name:e.target.value})}/><Input label="Descripción pública" value={benefit.description} onChange={e => setBenefit({...benefit,description:e.target.value})}/><select value={benefit.benefit_type} onChange={e => setBenefit({...benefit,benefit_type:e.target.value as CrewBenefitType,targets:''})} className="w-full border border-surface-300 p-2 text-sm"><option value="percentage_discount">Porcentaje general</option><option value="fixed_discount">Monto fijo</option><option value="product_discount">Por productos</option><option value="category_discount">Por categoría</option><option value="drop_discount">Por drop</option></select><Input label={benefit.benefit_type === 'fixed_discount' ? 'Monto Bs' : 'Porcentaje'} type="number" min="0" value={benefit.value} onChange={e => setBenefit({...benefit,value:e.target.value})}/>{['product_discount','category_discount','drop_discount'].includes(benefit.benefit_type) && <Input label={benefit.benefit_type === 'category_discount' ? 'Categorías separadas por coma' : 'IDs separados por coma'} value={benefit.targets} onChange={e => setBenefit({...benefit,targets:e.target.value})}/>}<div>{plans.map(plan => <label key={plan.id} className="mr-4 inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={benefit.planIds.includes(plan.id)} onChange={e => setBenefit({...benefit,planIds:e.target.checked ? [...benefit.planIds,plan.id] : benefit.planIds.filter(id => id !== plan.id)})}/>{plan.name}</label>)}</div><Button onClick={createBenefit}>Crear y asignar</Button></div></Card>
        {definitions.length > 0 && <Card><div className="space-y-3 p-5"><h2 className="font-bold">Beneficios configurados</h2>{definitions.map(item => <div key={item.id} className="flex items-start justify-between gap-3 border-t pt-3"><div><p className="text-sm font-semibold">{item.name} <span className="font-mono text-xs text-surface-400">{item.code}</span></p><p className="text-xs text-surface-500">{item.benefit_type} · {planIdsFor(item.id).map(id => plans.find(plan => plan.id === id)?.name).filter(Boolean).join(', ') || 'Sin plan'}</p></div><Button size="sm" variant="outline" onClick={() => act(() => crewService.saveBenefit({...item,is_active:!item.is_active},planIdsFor(item.id)))}>{item.is_active ? 'Desactivar' : 'Activar'}</Button></div>)}</div></Card>}
      </div>
    </div>}
  </div>;
}

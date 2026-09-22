import React, { useEffect, useState } from 'react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { customerService } from '../services/customerService';
import type { LoyaltySettings } from '../lib/types';


const SettingsPage: React.FC = () => {
  const [loyalty, setLoyalty] = useState<LoyaltySettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => { customerService.loyaltySettings().then(setLoyalty).catch(() => setMessage('No se pudo cargar la configuración de fidelidad.')); }, []);
  const saveLoyalty = async () => { if (!loyalty) return; setSaving(true); setMessage(''); try { setLoyalty(await customerService.updateLoyaltySettings(loyalty)); setMessage('Configuración de puntos guardada.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo guardar.'); } finally { setSaving(false); } };
  return <div className="mx-auto max-w-3xl p-8">
    <h1 className="text-2xl font-bold mb-4">Configuración General</h1>
    <p className="text-gray-600 mb-8">Personaliza los ajustes generales del sistema de gestión de Pass Clothing.</p>

    {/* Parámetros de la empresa */}
    <section className="mb-8 bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-2">Parámetros de la empresa</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Nombre de la empresa</label>
          <input type="text" className="w-full border rounded px-3 py-2" placeholder="Pass Clothing S.A. de C.V." disabled />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">RFC</label>
          <input type="text" className="w-full border rounded px-3 py-2" placeholder="XXXXXXXXXXXX" disabled />
        </div>
      </div>
      <p className="text-xs text-gray-400 mt-2">(Próximamente podrás editar estos datos)</p>
    </section>

    {/* Preferencias de visualización */}
    <section className="mb-8 bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-2">Preferencias de visualización</h2>
      <div className="flex items-center gap-4 mb-2">
        <label className="flex items-center gap-2">
          <input type="checkbox" className="accent-indigo-600" disabled />
          Modo oscuro automático
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" className="accent-indigo-600" disabled />
          Mostrar totales en la barra lateral
        </label>
      </div>
      <p className="text-xs text-gray-400">(Próximamente podrás personalizar la apariencia del sistema)</p>
    </section>

    {loyalty && <Card className="mb-8"><div className="space-y-5 p-6"><div><h2 className="text-xl font-semibold">Fidelidad / Puntos</h2><p className="mt-1 text-sm text-gray-500">Configura la regla sin hardcodear valores comerciales. Los cambios aplican a nuevas ventas.</p></div><label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={loyalty.enabled} onChange={e => setLoyalty({...loyalty, enabled: e.target.checked})}/> Activar acumulación de puntos</label><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Puntos por unidad monetaria<input type="number" min="0" step="0.01" value={loyalty.points_per_currency_unit} onChange={e => setLoyalty({...loyalty, points_per_currency_unit: Number(e.target.value)})} className="mt-1 w-full rounded border px-3 py-2"/></label><label className="text-sm">Cada Bs<input type="number" min="0.01" step="0.01" value={loyalty.currency_unit_amount} onChange={e => setLoyalty({...loyalty, currency_unit_amount: Number(e.target.value)})} className="mt-1 w-full rounded border px-3 py-2"/></label><label className="text-sm">Compra mínima<input type="number" min="0" step="0.01" value={loyalty.minimum_purchase_amount} onChange={e => setLoyalty({...loyalty, minimum_purchase_amount: Number(e.target.value)})} className="mt-1 w-full rounded border px-3 py-2"/></label><label className="text-sm">Máximo por venta<input type="number" min="0" placeholder="Sin límite" value={loyalty.max_points_per_sale ?? ''} onChange={e => setLoyalty({...loyalty, max_points_per_sale: e.target.value ? Number(e.target.value) : null})} className="mt-1 w-full rounded border px-3 py-2"/></label></div><div className="grid gap-4 sm:grid-cols-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={loyalty.expiration_enabled} onChange={e => setLoyalty({...loyalty, expiration_enabled: e.target.checked})}/> Activar expiración</label><label className="text-sm">Días de expiración<input type="number" min="1" disabled={!loyalty.expiration_enabled} value={loyalty.expiration_days ?? ''} onChange={e => setLoyalty({...loyalty, expiration_days: e.target.value ? Number(e.target.value) : null})} className="mt-1 w-full rounded border px-3 py-2 disabled:bg-gray-100"/></label></div><div className="border-t pt-4"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={loyalty.redemption_enabled} onChange={e => setLoyalty({...loyalty, redemption_enabled: e.target.checked})}/> Habilitar canje (arquitectura preparada; flujo aún no activo)</label><p className="mt-1 text-xs text-gray-500">No se implementa equivalencia de puntos a bolivianos hasta definirla.</p></div><div className="flex items-center justify-between border-t pt-4"><span className="text-sm text-gray-500">{message}</span><Button onClick={saveLoyalty} disabled={saving}>{saving ? 'Guardando…' : 'Guardar puntos'}</Button></div></div></Card>}

    {/* Integraciones */}
    <section className="mb-8 bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-2">Integraciones</h2>
      <ul className="list-disc pl-5 text-gray-700">
        <li>Correo electrónico (próximamente)</li>
        <li>Pasarelas de pago (próximamente)</li>
        <li>API de facturación (próximamente)</li>
      </ul>
      <p className="text-xs text-gray-400 mt-2">Configura servicios externos para potenciar tu sistema.</p>
    </section>

    {/* Control de acceso y permisos */}
    <section className="mb-8 bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-2">Control de acceso y permisos</h2>
      <ul className="list-disc pl-5 text-gray-700">
        <li>Gestión de roles de usuario (admin, vendedor, etc.)</li>
        <li>Permisos personalizados por módulo</li>
        <li>Invitar nuevos usuarios</li>
      </ul>
      <p className="text-xs text-gray-400 mt-2">(Próximamente podrás administrar los permisos y roles desde aquí)</p>
    </section>
  </div>;
};

export default SettingsPage;

import { useState, type FormEvent } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import type { Customer } from '../../lib/types';
import { customerService } from '../../services/customerService';

interface Props { open: boolean; onClose: () => void; onCreated: (customer: Customer) => void; }
export default function CreateCustomerModal({ open, onClose, onCreated }: Props) {
  const [firstName, setFirstName] = useState(''); const [lastName, setLastName] = useState(''); const [ci, setCi] = useState(''); const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(''); const [instagram, setInstagram] = useState(''); const [existing, setExisting] = useState<Customer | null>(null);
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setExisting(null);
    if (!firstName.trim() || !ci.trim() || !phone.trim()) { setError('Nombre, CI y teléfono son obligatorios.'); return; }
    setSaving(true);
    try {
      const matches = await customerService.search(`${ci.trim()} ${phone.trim()}`);
      const normalize = (value: string) => value.replace(/\D/g, '');
      const duplicate = matches.find(customer => normalize(customer.ci || '') === normalize(ci) || normalize(customer.phone || '') === normalize(phone));
      if (duplicate) { setExisting(duplicate); return; }
      const customer = await customerService.create({ first_name: firstName.trim(), last_name: lastName.trim() || null, ci: ci.trim(), phone: phone.trim(), email: email.trim() || null, instagram: instagram.trim() || null });
      onCreated(customer); onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo crear el cliente.'); }
    finally { setSaving(false); }
  };
  return <Modal isOpen={open} onClose={onClose} title="Nuevo cliente" description="Agrega los datos del cliente para asociarlo a esta venta."><form noValidate onSubmit={submit} className="space-y-5 p-6 sm:p-7"><div className="space-y-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-600">Datos principales</p><p className="mt-1 text-xs text-surface-500">Los campos marcados con * son obligatorios.</p></div><Input label="Nombre *" value={firstName} onChange={e => setFirstName(e.target.value)} autoFocus className="h-11"/><Input label="CI *" value={ci} onChange={e => setCi(e.target.value)} inputMode="numeric" className="h-11"/><Input label="Teléfono *" hint="Incluye el código de área si corresponde." value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" className="h-11"/><div className="grid gap-4 sm:grid-cols-2"><Input label="Apellido" value={lastName} onChange={e => setLastName(e.target.value)} className="h-11"/><Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} className="h-11"/></div><Input label="Instagram" hint="Opcional" value={instagram} onChange={e => setInstagram(e.target.value)} className="h-11"/></div>{existing && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><p className="font-semibold">Ya existe un cliente con este CI o número.</p><p className="mt-1 text-amber-900">{existing.full_name || existing.first_name} · {existing.customer_code} · {existing.phone}</p><Button type="button" className="mt-3" size="sm" onClick={() => { onCreated(existing); onClose(); }}>Seleccionar existente</Button></div>}{error && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</div>}<div className="flex flex-col-reverse gap-2 border-t border-surface-100 pt-5 sm:flex-row sm:justify-end"><Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={saving} className="sm:min-w-44">{saving ? 'Guardando…' : 'Crear y seleccionar'}</Button></div></form></Modal>;
}

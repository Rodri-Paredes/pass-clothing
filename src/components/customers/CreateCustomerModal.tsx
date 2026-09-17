import { useState, type FormEvent } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import type { Customer } from '../../lib/types';
import { customerService } from '../../services/customerService';

interface Props { open: boolean; onClose: () => void; onCreated: (customer: Customer) => void; }
export default function CreateCustomerModal({ open, onClose, onCreated }: Props) {
  const [firstName, setFirstName] = useState(''); const [lastName, setLastName] = useState(''); const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(''); const [instagram, setInstagram] = useState(''); const [existing, setExisting] = useState<Customer | null>(null);
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setExisting(null);
    if (!firstName.trim() || !phone.trim()) { setError('Nombre y teléfono son obligatorios.'); return; }
    setSaving(true);
    try {
      const matches = await customerService.search(phone.trim());
      const duplicate = matches.find(customer => customer.phone?.replace(/\D/g, '') === phone.replace(/\D/g, ''));
      if (duplicate) { setExisting(duplicate); return; }
      const customer = await customerService.create({ first_name: firstName.trim(), last_name: lastName.trim() || null, phone: phone.trim(), email: email.trim() || null, instagram: instagram.trim() || null });
      onCreated(customer); onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo crear el cliente.'); }
    finally { setSaving(false); }
  };
  return <Modal isOpen={open} onClose={onClose} title="Nuevo cliente"><form onSubmit={submit} className="space-y-4"><Input label="Nombre" value={firstName} onChange={e => setFirstName(e.target.value)} required autoFocus/><Input label="Teléfono" value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" required/><div className="grid gap-3 sm:grid-cols-2"><Input label="Apellido" value={lastName} onChange={e => setLastName(e.target.value)}/><Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)}/></div><Input label="Instagram" value={instagram} onChange={e => setInstagram(e.target.value)}/>{existing && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"><p>Ya existe un cliente con este número.</p><p className="mt-1 font-medium">{existing.full_name || existing.first_name} · {existing.customer_code} · {existing.phone}</p><Button type="button" className="mt-2" size="sm" onClick={() => { onCreated(existing); onClose(); }}>Seleccionar cliente existente</Button></div>}{error && <p className="text-sm text-red-600">{error}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Crear y seleccionar'}</Button></div></form></Modal>;
}

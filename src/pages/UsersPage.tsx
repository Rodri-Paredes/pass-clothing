import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';




const ROLES = [
  { value: 'admin', label: 'Administrador' },
  { value: 'vendedor', label: 'Vendedor' },
];

const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [form, setForm] = useState({ email: '', role: 'vendedor', password: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resetUser, setResetUser] = useState<any | null>(null);
  const [resetLoading, setResetLoading] = useState(false);


  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    const { data, error } = await supabase.from('users').select('*');
    if (!error) setUsers(data || []);
    setLoading(false);
  }

  function openCreate() {
    setEditingUser(null);
    setForm({ email: '', role: 'vendedor', password: '' });
    setShowModal(true);
    setError('');
    setSuccess('');
  }

  function openEdit(user: any) {
    setEditingUser(user);
    setForm({ email: user.email, role: user.role, password: '' });
    setShowModal(true);
    setError('');
    setSuccess('');
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!form.email || (!editingUser && !form.password)) {
      setError('El correo y la contraseña son obligatorios para nuevos usuarios.');
      return;
    }
    setLoading(true);
    // supabase siempre está definido por import
    if (editingUser) {
      // Update role only
      const { error } = await supabase.from('users').update({ role: form.role }).eq('id', editingUser.id);
      if (error) setError('Error al actualizar usuario');
      else {
        setSuccess('Usuario actualizado');
        fetchUsers();
        setShowModal(false);
      }
    } else {
      // Crear usuario usando signUp (registro normal)
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
      });
      if (error) {
        setError('Error al crear usuario: ' + error.message);
        setLoading(false);
        return;
      }
      // Insertar el rol en la tabla users
      if (data.user) {
        const { error: insertError } = await supabase.from('users').insert([
          { id: data.user.id, email: form.email, role: form.role }
        ]);
        if (insertError) {
          setError('Usuario creado pero error al asignar rol: ' + insertError.message);
        } else {
          setSuccess('Usuario creado');
          fetchUsers();
          setShowModal(false);
        }
      } else {
        setError('Usuario creado pero no se pudo obtener el ID.');
      }
      setLoading(false);
    }
  }

  async function handleResetPassword(user: any) {
    setResetUser(user);
    setResetLoading(true);
    setError('');
    setSuccess('');
    // supabase siempre está definido por import
    // Send password reset email
    const { error } = await supabase.auth.resetPasswordForEmail(user.email);
    if (error) setError('Error al enviar correo de restablecimiento');
    else setSuccess('Correo de restablecimiento enviado');
    setResetLoading(false);
    setTimeout(() => setResetUser(null), 2000);
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Gestión de Usuarios</h1>
      <div className="flex justify-between items-center mb-4">
        <span className="text-gray-600">Administra los usuarios, roles y accesos del sistema.</span>
        <Button onClick={openCreate}>Nuevo usuario</Button>
      </div>



      {/* Tabla de usuarios */}
      <div className="overflow-x-auto bg-white rounded shadow">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="py-2 px-4 text-left">Correo</th>
              <th className="py-2 px-4 text-left">Rol</th>
              <th className="py-2 px-4 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={3} className="text-center py-4">Cargando...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={3} className="text-center py-4">Sin usuarios</td></tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="border-b">
                  <td className="py-2 px-4">{user.email}</td>
                  <td className="py-2 px-4 capitalize">{user.role}</td>
                  <td className="py-2 px-4 flex gap-2">
                    <Button size="sm" onClick={() => openEdit(user)}>Editar</Button>
                    <Button size="sm" variant="secondary" onClick={() => handleResetPassword(user)} disabled={resetLoading && resetUser?.id === user.id}>
                      {resetLoading && resetUser?.id === user.id ? 'Enviando...' : 'Restablecer contraseña'}
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de creación/edición */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingUser ? 'Editar usuario' : 'Nuevo usuario'}>
        <form onSubmit={handleSave} className="space-y-4 p-4">
          <div>
            <label className="block text-sm font-medium mb-1">Correo electrónico</label>
            <Input
              type="email"
              value={form.email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, email: e.target.value }))}
              disabled={!!editingUser}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Rol</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
            >
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          {!editingUser && (
            <div>
              <label className="block text-sm font-medium mb-1">Contraseña</label>
              <Input
                type="password"
                value={form.password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, password: e.target.value }))}
                required
              />
            </div>
          )}
          {error && <div className="text-red-500 text-sm">{error}</div>}
          {success && <div className="text-green-600 text-sm">{success}</div>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button type="submit" isLoading={loading}>{editingUser ? 'Guardar' : 'Crear'}</Button>
          </div>
        </form>
      </Modal>

      {/* Historial de accesos y auditoría (placeholder) */}
      <div className="mt-10 bg-white rounded shadow p-6">
        <h2 className="text-lg font-semibold mb-2">Historial de accesos y auditoría</h2>
        <p className="text-gray-500">Próximamente podrás ver el historial de accesos y acciones de los usuarios.</p>
      </div>
    </div>
  );
};

export default UsersPage;

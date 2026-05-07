import React from 'react';


const SettingsPage: React.FC = () => (
  <div className="p-8 max-w-3xl mx-auto">
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
  </div>
);

export default SettingsPage;

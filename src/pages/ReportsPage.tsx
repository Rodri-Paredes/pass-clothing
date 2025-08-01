import React from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

const ReportsPage: React.FC = () => {
  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold mb-6">Reportes Avanzados</h1>
      <Card className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Ventas por sucursal</h2>
        <p className="text-gray-600 mb-4">Visualiza el total de ventas agrupadas por sucursal y rango de fechas.</p>
        <Button>Exportar a Excel</Button>
      </Card>
      <Card className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Productos más vendidos</h2>
        <p className="text-gray-600 mb-4">Consulta los productos con mayor rotación y stock bajo.</p>
        <Button>Ver detalles</Button>
      </Card>
      <Card>
        <h2 className="text-lg font-semibold mb-2">Historial de cierres de caja</h2>
        <p className="text-gray-600 mb-4">Accede al historial de cierres diarios y descárgalos en PDF.</p>
        <Button>Descargar PDF</Button>
      </Card>
    </div>
  );
};

export default ReportsPage;

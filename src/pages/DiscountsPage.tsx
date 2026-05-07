import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Tag, TrendingDown, Calendar, CheckCircle } from 'lucide-react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import DiscountForm from '../components/discounts/DiscountForm';
import DiscountList from '../components/discounts/DiscountList';
import { useDiscountStore } from '../store/discountStore';
import { discountService } from '../services/discountService';
import type { Discount, DiscountStatus } from '../lib/types';

const DiscountsPage: React.FC = () => {
  const { discounts, isLoading, loadDiscounts, deleteDiscount, toggleDiscountActive } =
    useDiscountStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedDiscount, setSelectedDiscount] = useState<Discount | null>(null);
  const [filterStatus, setFilterStatus] = useState<DiscountStatus | 'all'>('all');

  useEffect(() => {
    loadDiscounts();
  }, [loadDiscounts]);

  // Calcular estadísticas
  const stats = React.useMemo(() => {
    const active = discounts.filter(
      (d) => discountService.getDiscountStatus(d) === 'active'
    ).length;
    const scheduled = discounts.filter(
      (d) => discountService.getDiscountStatus(d) === 'scheduled'
    ).length;
    const expired = discounts.filter(
      (d) => discountService.getDiscountStatus(d) === 'expired'
    ).length;
    const totalProducts = discounts.reduce(
      (sum, d) => sum + (d.product_count || 0),
      0
    );

    return { active, scheduled, expired, totalProducts, total: discounts.length };
  }, [discounts]);

  const handleEdit = useCallback((discount: Discount) => {
    setSelectedDiscount(discount);
    setShowEditModal(true);
  }, []);

  const handleDeleteClick = useCallback((discount: Discount) => {
    setSelectedDiscount(discount);
    setShowDeleteModal(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!selectedDiscount) return;
    try {
      await deleteDiscount(selectedDiscount.id);
      setShowDeleteModal(false);
      setSelectedDiscount(null);
    } catch (error: any) {
      alert(`Error al eliminar: ${error.message}`);
    }
  }, [selectedDiscount, deleteDiscount]);

  const handleToggleActive = useCallback(
    async (discount: Discount) => {
      try {
        await toggleDiscountActive(discount.id);
      } catch (error: any) {
        alert(`Error: ${error.message}`);
      }
    },
    [toggleDiscountActive]
  );

  const handleSave = useCallback(() => {
    loadDiscounts();
  }, [loadDiscounts]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Descuentos</h1>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Nuevo Descuento</span>
        </Button>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card padding="sm">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Activos</p>
              <p className="text-xl font-bold text-gray-900">{stats.active}</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Programados</p>
              <p className="text-xl font-bold text-gray-900">{stats.scheduled}</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <TrendingDown className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Expirados</p>
              <p className="text-xl font-bold text-gray-900">{stats.expired}</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Tag className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Productos c/descuento</p>
              <p className="text-xl font-bold text-gray-900">{stats.totalProducts}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filtros por estado */}
      <Card>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { value: 'all', label: 'Todos', count: stats.total },
              { value: 'active', label: 'Activos', count: stats.active },
              { value: 'scheduled', label: 'Programados', count: stats.scheduled },
              { value: 'expired', label: 'Expirados', count: stats.expired },
            ] as { value: DiscountStatus | 'all'; label: string; count: number }[]
          ).map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilterStatus(tab.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterStatus === tab.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
      </Card>

      {/* Lista de descuentos */}
      <DiscountList
        discounts={discounts}
        isLoading={isLoading}
        onEdit={handleEdit}
        onDelete={handleDeleteClick}
        onToggleActive={handleToggleActive}
        filterStatus={filterStatus}
      />

      {/* Modal Crear Descuento */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Nuevo Descuento"
        size="xl"
      >
        <DiscountForm
          onClose={() => setShowCreateModal(false)}
          onSave={handleSave}
        />
      </Modal>

      {/* Modal Editar Descuento */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedDiscount(null);
        }}
        title="Editar Descuento"
        size="xl"
      >
        <DiscountForm
          discount={selectedDiscount}
          onClose={() => {
            setShowEditModal(false);
            setSelectedDiscount(null);
          }}
          onSave={handleSave}
        />
      </Modal>

      {/* Modal Confirmar Eliminación */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedDiscount(null);
        }}
        title="Eliminar Descuento"
        size="sm"
      >
        {selectedDiscount && (
          <div className="p-6">
            <div className="mb-4">
              <p className="text-gray-700">
                ¿Estás seguro de que deseas eliminar el descuento{' '}
                <strong>"{selectedDiscount.name}"</strong>?
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Esta acción eliminará el descuento y desvinculará todos los productos
                asociados. Los precios originales de los productos no se verán afectados.
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedDiscount(null);
                }}
              >
                Cancelar
              </Button>
              <Button variant="danger" onClick={handleConfirmDelete}>
                Eliminar Descuento
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DiscountsPage;

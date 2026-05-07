import React from 'react';
import { Edit, Trash2, ToggleLeft, ToggleRight, Calendar, Tag, Package, Clock } from 'lucide-react';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { discountService } from '../../services/discountService';
import type { Discount, DiscountStatus } from '../../lib/types';

interface DiscountListProps {
  discounts: Discount[];
  isLoading: boolean;
  onEdit: (discount: Discount) => void;
  onDelete: (discount: Discount) => void;
  onToggleActive: (discount: Discount) => void;
  filterStatus: DiscountStatus | 'all';
}

const statusConfig: Record<DiscountStatus, { label: string; color: string; bgColor: string }> = {
  active: {
    label: 'Activo',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
  },
  scheduled: {
    label: 'Programado',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
  },
  expired: {
    label: 'Expirado',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
  },
};

const DiscountList: React.FC<DiscountListProps> = ({
  discounts,
  isLoading,
  onEdit,
  onDelete,
  onToggleActive,
  filterStatus,
}) => {
  const filteredDiscounts = discounts.filter((d) => {
    if (filterStatus === 'all') return true;
    return discountService.getDiscountStatus(d) === filterStatus;
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-BO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRemainingTime = (endDate: string): string => {
    const now = new Date();
    const end = new Date(endDate);
    const diff = end.getTime() - now.getTime();

    if (diff <= 0) return 'Expirado';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days}d ${hours}h restantes`;
    return `${hours}h restantes`;
  };

  if (isLoading) {
    return (
      <Card className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-3 text-sm text-gray-500">Cargando descuentos...</p>
      </Card>
    );
  }

  if (filteredDiscounts.length === 0) {
    return (
      <Card className="text-center py-12">
        <Tag className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No hay descuentos</h3>
        <p className="text-gray-600">
          {filterStatus === 'all'
            ? 'Comienza creando tu primer descuento.'
            : `No hay descuentos con estado "${statusConfig[filterStatus as DiscountStatus]?.label || filterStatus}".`}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {filteredDiscounts.map((discount) => {
        const status = discountService.getDiscountStatus(discount);
        const config = statusConfig[status];

        return (
          <Card key={discount.id} className="overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {/* Info principal */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900 truncate">
                    {discount.name}
                  </h3>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.color}`}
                  >
                    {config.label}
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                    -{discount.percentage}%
                  </span>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate(discount.start_date)} — {formatDate(discount.end_date)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Package className="h-3.5 w-3.5" />
                    {discount.product_count || 0} producto(s)
                  </span>
                  {discount.drop_count !== undefined && discount.drop_count > 0 && (
                    <span className="flex items-center gap-1 text-purple-600">
                      <Tag className="h-3.5 w-3.5" />
                      {discount.drop_count} drop(s)
                    </span>
                  )}
                  {status === 'active' && (
                    <span className="flex items-center gap-1 text-green-600 font-medium">
                      <Clock className="h-3.5 w-3.5" />
                      {getRemainingTime(discount.end_date)}
                    </span>
                  )}
                  {status === 'scheduled' && (
                    <span className="flex items-center gap-1 text-blue-600 font-medium">
                      <Clock className="h-3.5 w-3.5" />
                      Inicia {formatDate(discount.start_date)}
                    </span>
                  )}
                </div>
              </div>

              {/* Acciones */}
              <div className="flex items-center space-x-2 flex-shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onToggleActive(discount)}
                  title={discount.is_active ? 'Desactivar' : 'Activar'}
                  className={
                    discount.is_active
                      ? 'text-green-600 hover:text-green-700'
                      : 'text-gray-400 hover:text-gray-600'
                  }
                >
                  {discount.is_active ? (
                    <ToggleRight className="h-5 w-5" />
                  ) : (
                    <ToggleLeft className="h-5 w-5" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onEdit(discount)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => onDelete(discount)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};

export default DiscountList;

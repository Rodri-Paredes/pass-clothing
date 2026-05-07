import React, { useState } from 'react';
import { CreditCard, DollarSign, Smartphone } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Modal from '../ui/Modal';
import type { Sale } from '../../lib/types';

interface EditPaymentMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale;
  onSave: (
    saleId: string, 
    newPaymentType: 'QR' | 'EFECTIVO' | 'TARJETA' | 'MIXTO',
    paymentDetails?: { efectivo?: number; qr?: number; tarjeta?: number }
  ) => Promise<void>;
}

const EditPaymentMethodModal: React.FC<EditPaymentMethodModalProps> = ({
  isOpen,
  onClose,
  sale,
  onSave
}) => {
  const [selectedPaymentType, setSelectedPaymentType] = useState<'QR' | 'EFECTIVO' | 'TARJETA' | 'MIXTO'>(
    sale.payment_type
  );
  const [mixedPaymentDetails, setMixedPaymentDetails] = useState({
    efectivo: sale.payment_details?.efectivo || 0,
    qr: sale.payment_details?.qr || 0,
    tarjeta: sale.payment_details?.tarjeta || 0
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>('');

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError('');
      
      // Validar pago mixto
      if (selectedPaymentType === 'MIXTO') {
        const total = mixedPaymentDetails.efectivo + mixedPaymentDetails.qr + mixedPaymentDetails.tarjeta;
        if (Math.abs(total - sale.total) > 0.01) {
          setError(`La suma de los pagos (${total.toFixed(2)}) debe ser igual al total (${sale.total.toFixed(2)})`);
          setIsSaving(false);
          return;
        }
        await onSave(sale.id, selectedPaymentType, mixedPaymentDetails);
      } else {
        await onSave(sale.id, selectedPaymentType);
      }
      
      onClose();
    } catch (error) {
      console.error('Error updating payment method:', error);
      setError('Error al actualizar el método de pago. Intenta nuevamente.');
      setIsSaving(false);
    }
  };

  const handleMixedPaymentChange = (type: 'efectivo' | 'qr' | 'tarjeta', value: string) => {
    const numValue = parseFloat(value) || 0;
    setMixedPaymentDetails(prev => ({
      ...prev,
      [type]: numValue
    }));
  };

  const getTotalMixedPayment = () => {
    return mixedPaymentDetails.efectivo + mixedPaymentDetails.qr + mixedPaymentDetails.tarjeta;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Editar Método de Pago"
      size="md"
    >
      <div className="space-y-6 p-4">
        {/* Información de la venta */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">Venta #{sale.id.slice(-8)}</span>
            <span className="text-xl font-bold text-blue-600">${sale.total.toFixed(2)}</span>
          </div>
          <div className="text-sm text-gray-600">
            Método actual: <span className="font-semibold">{sale.payment_type}</span>
          </div>
        </div>

        {/* Selector de método de pago */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Nuevo método de pago</h3>
          <div className="grid grid-cols-2 gap-3">
            {/* Efectivo */}
            <button
              className={`p-4 border-2 rounded-xl transition-all flex flex-col items-center gap-2 
                ${selectedPaymentType === 'EFECTIVO' 
                  ? 'border-green-500 bg-green-50' 
                  : 'border-gray-200 bg-white'} hover:border-green-400`}
              onClick={() => setSelectedPaymentType('EFECTIVO')}
            >
              <DollarSign className="h-8 w-8 text-green-600" />
              <span className="font-semibold text-gray-700">Efectivo</span>
            </button>

            {/* QR */}
            <button
              className={`p-4 border-2 rounded-xl transition-all flex flex-col items-center gap-2 
                ${selectedPaymentType === 'QR' 
                  ? 'border-indigo-500 bg-indigo-50' 
                  : 'border-gray-200 bg-white'} hover:border-indigo-400`}
              onClick={() => setSelectedPaymentType('QR')}
            >
              <Smartphone className="h-8 w-8 text-indigo-600" />
              <span className="font-semibold text-gray-700">QR</span>
            </button>

            {/* Tarjeta */}
            <button
              className={`p-4 border-2 rounded-xl transition-all flex flex-col items-center gap-2 
                ${selectedPaymentType === 'TARJETA' 
                  ? 'border-pink-500 bg-pink-50' 
                  : 'border-gray-200 bg-white'} hover:border-pink-400`}
              onClick={() => setSelectedPaymentType('TARJETA')}
            >
              <CreditCard className="h-8 w-8 text-pink-600" />
              <span className="font-semibold text-gray-700">Tarjeta</span>
            </button>

            {/* Mixto */}
            <button
              className={`p-4 border-2 rounded-xl transition-all flex flex-col items-center gap-2 
                ${selectedPaymentType === 'MIXTO' 
                  ? 'border-purple-500 bg-purple-50' 
                  : 'border-gray-200 bg-white'} hover:border-purple-400`}
              onClick={() => setSelectedPaymentType('MIXTO')}
            >
              <div className="flex gap-1">
                <DollarSign className="h-6 w-6 text-purple-600" />
                <Smartphone className="h-6 w-6 text-purple-600" />
              </div>
              <span className="font-semibold text-gray-700">Mixto</span>
            </button>
          </div>
        </div>

        {/* Detalles de pago mixto */}
        {selectedPaymentType === 'MIXTO' && (
          <div className="bg-purple-50 p-4 rounded-lg space-y-3">
            <h4 className="text-sm font-semibold text-gray-700">Desglose de pago</h4>
            <div className="space-y-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Efectivo
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={mixedPaymentDetails.efectivo}
                  onChange={(e) => handleMixedPaymentChange('efectivo', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  QR
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={mixedPaymentDetails.qr}
                  onChange={(e) => handleMixedPaymentChange('qr', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tarjeta
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={mixedPaymentDetails.tarjeta}
                  onChange={(e) => handleMixedPaymentChange('tarjeta', e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-purple-200">
              <span className="text-sm font-semibold text-gray-700">Total:</span>
              <span className={`text-lg font-bold ${
                Math.abs(getTotalMixedPayment() - sale.total) < 0.01 
                  ? 'text-green-600' 
                  : 'text-red-600'
              }`}>
                ${getTotalMixedPayment().toFixed(2)}
              </span>
            </div>
            {Math.abs(getTotalMixedPayment() - sale.total) >= 0.01 && (
              <p className="text-xs text-red-600">
                El total debe ser ${sale.total.toFixed(2)}
              </p>
            )}
          </div>
        )}

        {/* Mensaje de error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Botones de acción */}
        <div className="flex gap-3 pt-4">
          <Button
            onClick={onClose}
            variant="secondary"
            className="flex-1"
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            className="flex-1"
            disabled={
              isSaving || 
              (selectedPaymentType === 'MIXTO' && 
                Math.abs(getTotalMixedPayment() - sale.total) >= 0.01)
            }
          >
            {isSaving ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default EditPaymentMethodModal;

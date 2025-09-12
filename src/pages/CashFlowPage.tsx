import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  DollarSign, 
  Lock, 
  Unlock, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  User, 
  FileText, 
  Printer, 
  Plus, 
  Minus,
  AlertCircle,
  CheckCircle,
  Calendar,
  Wallet,
  QrCode,
  CreditCard
} from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import { useAuthStore } from '../store/authStore';
import { cashRegisterService } from '../services/cashRegisterService';
import type { 
  OpenCashRegister, 
  CashMovementWithUser, 
  CashRegisterHistory 
} from '../lib/types';

const CashFlowPage: React.FC = () => {
  const { activeBranch, user } = useAuthStore();
  const navigate = useNavigate();
  
  // Estados principales
  const [openRegister, setOpenRegister] = useState<OpenCashRegister | null>(null);
  const [movements, setMovements] = useState<any[]>([]);
  const [history, setHistory] = useState<CashRegisterHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    hasOpenRegister: false,
    todaySales: 0,
    todayCash: 0,
    todayQR: 0,
    todayCard: 0
  });

  // Estados para modales
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Estados para formularios
  const [openingAmount, setOpeningAmount] = useState('');
  const [openingNotes, setOpeningNotes] = useState('');
  const [closingAmount, setClosingAmount] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [movementType, setMovementType] = useState<'INGRESO' | 'EGRESO'>('INGRESO');
  const [movementPaymentType, setMovementPaymentType] = useState<'EFECTIVO' | 'QR' | 'TARJETA'>('EFECTIVO');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementDescription, setMovementDescription] = useState('');

  // Estados para fechas (ajustadas a Bolivia)
  const getLaPazDate = () => {
    const laPazNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/La_Paz' }));
    const y = laPazNow.getFullYear();
    const m = String(laPazNow.getMonth() + 1).padStart(2, '0');
    const d = String(laPazNow.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  const [startDate, setStartDate] = useState(getLaPazDate());
  const [endDate, setEndDate] = useState(getLaPazDate());

  useEffect(() => {
    if (activeBranch) {
      loadCashFlowData();
    }
  }, [activeBranch]);

  const loadCashFlowData = async () => {
    if (!activeBranch) return;
    
    setIsLoading(true);
    try {
      const statsData = await cashRegisterService.getCashRegisterStats(activeBranch.id);
      setStats(statsData);
      
      if (statsData.hasOpenRegister && statsData.openRegister) {
        setOpenRegister(statsData.openRegister);
        const movementsData = await cashRegisterService.getCashMovementsGrouped(statsData.openRegister.id);
        setMovements(movementsData);
      }
    } catch (error) {
      console.error('Error loading cash flow data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCashRegister = async () => {
    if (!activeBranch || !openingAmount) return;
    
    try {
      await cashRegisterService.openCashRegister(
        activeBranch.id,
        parseFloat(openingAmount),
        openingNotes || undefined
      );
      
      setShowOpenModal(false);
      setOpeningAmount('');
      setOpeningNotes('');
      await loadCashFlowData();
    } catch (error) {
      console.error('Error opening cash register:', error);
      alert('Error al abrir caja: ' + (error as Error).message);
    }
  };

  const handleCloseCashRegister = async () => {
    if (!openRegister || !closingAmount) return;
    
    try {
      await cashRegisterService.closeCashRegister(
        openRegister.id,
        parseFloat(closingAmount),
        closingNotes || undefined
      );
      
      setShowCloseModal(false);
      setClosingAmount('');
      setClosingNotes('');
      await loadCashFlowData();
    } catch (error) {
      console.error('Error closing cash register:', error);
      alert('Error al cerrar caja: ' + (error as Error).message);
    }
  };

  const handleAddMovement = async (): Promise<boolean> => {
    if (!openRegister || !movementAmount || !movementDescription) return false;
    
    try {
      await cashRegisterService.addManualMovement(
        openRegister.id,
        user!.id,
        movementType,
        movementPaymentType,
        parseFloat(movementAmount),
        movementDescription
      );
      
      setShowMovementModal(false);
      setMovementAmount('');
      setMovementDescription('');
      await loadCashFlowData();
      
      // Mostrar modal de éxito
      setShowSuccessModal(true);
      return true;
    } catch (error) {
      console.error('Error adding movement:', error);
      alert('Error al agregar movimiento: ' + (error as Error).message);
      return false;
    }
  };

  const loadHistory = async () => {
    if (!activeBranch) return;
    
    try {
      const historyData = await cashRegisterService.getCashRegisterHistory(
        activeBranch.id,
        startDate,
        endDate
      );
      setHistory(historyData);
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'BOB'
    }).format(amount);
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getMovementIcon = (type: string, paymentType: string) => {
    if (type === 'INGRESO') {
      switch (paymentType) {
        case 'EFECTIVO': return <Wallet className="h-4 w-4 text-green-600" />;
        case 'QR': return <QrCode className="h-4 w-4 text-blue-600" />;
        case 'TARJETA': return <CreditCard className="h-4 w-4 text-purple-600" />;
        default: return <TrendingUp className="h-4 w-4 text-green-600" />;
      }
    } else {
      return <TrendingDown className="h-4 w-4 text-red-600" />;
    }
  };

  if (!activeBranch) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="text-center max-w-md mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <DollarSign className="h-10 w-10 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Sin sucursal seleccionada</h3>
            <p className="text-gray-600 leading-relaxed">
              Selecciona una sucursal para gestionar el flujo de caja
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Cargando flujo de caja...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center">
                    <DollarSign className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Flujo de Caja</h1>
                    <p className="text-gray-600 font-medium">{activeBranch.name}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Gestión completa de apertura, cierre y movimientos de caja
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3">
                {!stats.hasOpenRegister ? (
                  <Button
                    onClick={() => setShowOpenModal(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
                  >
                    <Unlock className="h-4 w-4" />
                    Abrir Caja
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={() => setShowMovementModal(true)}
                      variant="secondary"
                      className="flex items-center gap-2 px-4 py-2"
                    >
                      <Plus className="h-4 w-4" />
                      Movimiento
                    </Button>
                    <Button
                      onClick={() => setShowCloseModal(true)}
                      className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white"
                    >
                      <Lock className="h-4 w-4" />
                      Cerrar Caja
                    </Button>
                  </>
                )}
                <Button
                  onClick={() => setShowHistoryModal(true)}
                  variant="secondary"
                  className="flex items-center gap-2 px-4 py-2"
                >
                  <FileText className="h-4 w-4" />
                  Historial
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Estado de Caja */}
        <div className="mb-8">
          <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                stats.hasOpenRegister 
                  ? 'bg-gradient-to-br from-green-500 to-green-600' 
                  : 'bg-gradient-to-br from-red-500 to-red-600'
              }`}>
                {stats.hasOpenRegister ? (
                  <Unlock className="h-5 w-5 text-white" />
                ) : (
                  <Lock className="h-5 w-5 text-white" />
                )}
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {stats.hasOpenRegister ? 'Caja Abierta' : 'Caja Cerrada'}
                </h3>
                <p className="text-gray-600">
                  {stats.hasOpenRegister 
                    ? `Abierta por ${openRegister?.opening_user_name} el ${formatDateTime(openRegister?.opening_date || '')}`
                    : 'No hay caja abierta en esta sucursal'
                  }
                </p>
              </div>
            </div>

            {stats.hasOpenRegister && openRegister && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Wallet className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">Fondo Inicial</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-900">{formatCurrency(openRegister.opening_amount)}</p>
                </div>
                
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800">Esperado Efectivo</span>
                  </div>
                  <p className="text-2xl font-bold text-green-900">{formatCurrency(openRegister.expected_cash)}</p>
                </div>
                
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
                  <div className="flex items-center gap-2 mb-2">
                    <QrCode className="h-4 w-4 text-purple-600" />
                    <span className="text-sm font-medium text-purple-800">Esperado QR</span>
                  </div>
                  <p className="text-2xl font-bold text-purple-900">{formatCurrency(openRegister.expected_qr)}</p>
                </div>
                
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4 border border-orange-200">
                  <div className="flex items-center gap-2 mb-2">
                    <CreditCard className="h-4 w-4 text-orange-600" />
                    <span className="text-sm font-medium text-orange-800">Esperado Tarjeta</span>
                  </div>
                  <p className="text-2xl font-bold text-orange-900">{formatCurrency(openRegister.expected_card)}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Ventas del Día */}
        <div className="mb-8">
          <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Ventas del Día</h3>
                <p className="text-gray-600">Resumen de ventas registradas hoy</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4" />
                  <span className="text-sm font-medium">Total Ventas</span>
                </div>
                <p className="text-2xl font-bold">{formatCurrency(stats.todaySales)}</p>
              </div>
              
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="h-4 w-4" />
                  <span className="text-sm font-medium">Efectivo</span>
                </div>
                <p className="text-2xl font-bold">{formatCurrency(stats.todayCash)}</p>
              </div>
              
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <QrCode className="h-4 w-4" />
                  <span className="text-sm font-medium">QR</span>
                </div>
                <p className="text-2xl font-bold">{formatCurrency(stats.todayQR)}</p>
              </div>
              
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard className="h-4 w-4" />
                  <span className="text-sm font-medium">Tarjeta</span>
                </div>
                <p className="text-2xl font-bold">{formatCurrency(stats.todayCard)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Movimientos de Caja */}
        {stats.hasOpenRegister && movements.length > 0 && (
          <div className="mb-8">
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="p-6 sm:p-8 border-b border-gray-100">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-gray-500 to-gray-600 rounded-lg flex items-center justify-center">
                    <FileText className="h-4 w-4 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Movimientos de Caja</h3>
                </div>
                <p className="text-gray-600">Historial de todos los movimientos registrados</p>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Hora
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Tipo
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Método
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Descripción
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Usuario
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Monto
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {movements.map((movement) => (
                      <tr key={movement.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDateTime(movement.created_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {getMovementIcon(movement.movement_type, movement.payment_type)}
                            <span className={`text-sm font-medium ${
                              movement.movement_type === 'INGRESO' ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {movement.movement_type}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
                          {movement.payment_type}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {movement.description}
                          {movement.is_grouped && (
                            <div className="text-xs text-gray-500 mt-1">
                              Venta con pago mixto
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {movement.user_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                          {movement.is_grouped ? (
                            <div>
                              <div className="text-lg">{formatCurrency(movement.total_amount)}</div>
                              <div className="text-xs text-gray-500">Total agrupado</div>
                            </div>
                          ) : (
                            formatCurrency(movement.amount)
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Estado vacío */}
        {!stats.hasOpenRegister && (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Lock className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Caja Cerrada</h3>
            <p className="text-gray-600 max-w-md mx-auto mb-6">
              No hay caja abierta en esta sucursal. Abre una caja para comenzar a registrar movimientos.
            </p>
            <Button
              onClick={() => setShowOpenModal(true)}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
            >
              <Unlock className="h-4 w-4" />
              Abrir Caja
            </Button>
          </div>
        )}
      </div>

      {/* Modal de Apertura de Caja */}
      <Modal
        isOpen={showOpenModal}
        onClose={() => setShowOpenModal(false)}
        title="Abrir Caja"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Monto Inicial (Bs.)
            </label>
            <Input
              type="number"
              value={openingAmount}
              onChange={(e) => setOpeningAmount(e.target.value)}
              placeholder="0.00"
              step="0.01"
              min="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Observaciones (Opcional)
            </label>
            <textarea
              value={openingNotes}
              onChange={(e) => setOpeningNotes(e.target.value)}
              placeholder="Notas sobre la apertura de caja..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => setShowOpenModal(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleOpenCashRegister}
              disabled={!openingAmount}
              className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
            >
              Abrir Caja
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de Cierre de Caja */}
      <Modal
        isOpen={showCloseModal}
        onClose={() => setShowCloseModal(false)}
        title="Cerrar Caja"
        size="md"
      >
        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <span className="font-medium text-yellow-800">Importante</span>
            </div>
            <p className="text-sm text-yellow-700">
              Cuenta todo el dinero físico en caja antes de ingresar el monto. 
              El sistema calculará automáticamente la diferencia.
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Monto Contado (Bs.)
            </label>
            <Input
              type="number"
              value={closingAmount}
              onChange={(e) => setClosingAmount(e.target.value)}
              placeholder="0.00"
              step="0.01"
              min="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Observaciones (Opcional)
            </label>
            <textarea
              value={closingNotes}
              onChange={(e) => setClosingNotes(e.target.value)}
              placeholder="Notas sobre el cierre de caja..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => setShowCloseModal(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCloseCashRegister}
              disabled={!closingAmount}
              className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white"
            >
              Cerrar Caja
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de Movimiento Manual */}
      <Modal
        isOpen={showMovementModal}
        onClose={() => setShowMovementModal(false)}
        title="Agregar Movimiento"
        size="md"
      >
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              <span className="font-medium text-blue-800">Nueva Funcionalidad</span>
            </div>
            <p className="text-sm text-blue-700">
              Después de agregar un movimiento, puedes ir directamente a la página de ventas para procesar una venta.
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Movimiento
              </label>
              <select
                value={movementType}
                onChange={(e) => setMovementType(e.target.value as 'INGRESO' | 'EGRESO')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="INGRESO">Ingreso</option>
                <option value="EGRESO">Egreso</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Método de Pago
              </label>
              <select
                value={movementPaymentType}
                onChange={(e) => setMovementPaymentType(e.target.value as 'EFECTIVO' | 'QR' | 'TARJETA')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="EFECTIVO">Efectivo</option>
                <option value="QR">QR</option>
                <option value="TARJETA">Tarjeta</option>
              </select>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Monto (Bs.)
            </label>
            <Input
              type="number"
              value={movementAmount}
              onChange={(e) => setMovementAmount(e.target.value)}
              placeholder="0.00"
              step="0.01"
              min="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Descripción
            </label>
            <textarea
              value={movementDescription}
              onChange={(e) => setMovementDescription(e.target.value)}
              placeholder="Descripción del movimiento..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => setShowMovementModal(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAddMovement}
              disabled={!movementAmount || !movementDescription}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
            >
              Agregar Movimiento
            </Button>
            <Button
              onClick={async () => {
                if (await handleAddMovement()) {
                  navigate('/sales');
                }
              }}
              disabled={!movementAmount || !movementDescription}
              className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
            >
              Agregar e Ir a Ventas
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de Historial */}
      <Modal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        title="Historial de Cajas"
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha Inicio
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha Fin
              </label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          
          <Button
            onClick={loadHistory}
            className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
          >
            Cargar Historial
          </Button>

          {history.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">
                      Fecha Apertura
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">
                      Fecha Cierre
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">
                      Fondo Inicial
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">
                      Total Esperado
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">
                      Diferencia
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {history.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {formatDateTime(item.opening_date)}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {item.closing_date ? formatDateTime(item.closing_date) : '-'}
                      </td>
                      <td className="px-4 py-2 text-sm font-medium text-gray-900">
                        {formatCurrency(item.opening_amount)}
                      </td>
                      <td className="px-4 py-2 text-sm font-medium text-gray-900">
                        {formatCurrency(item.expected_total)}
                      </td>
                      <td className="px-4 py-2 text-sm font-medium">
                        {item.cash_difference !== undefined ? (
                          <span className={item.cash_difference >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatCurrency(item.cash_difference)}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          item.status === 'ABIERTA' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {item.status === 'ABIERTA' ? (
                            <>
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Abierta
                            </>
                          ) : (
                            <>
                              <Lock className="h-3 w-3 mr-1" />
                              Cerrada
                            </>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {history.length === 0 && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-600">No hay historial para mostrar en el rango de fechas seleccionado</p>
            </div>
          )}

          <div className="flex justify-end pt-4">
            <Button
              variant="secondary"
              onClick={() => setShowHistoryModal(false)}
            >
              Cerrar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de Éxito */}
      <Modal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title="Movimiento Agregado Exitosamente"
        size="md"
      >
        <div className="space-y-6 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="h-10 w-10 text-white" />
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              ¡Movimiento Registrado!
            </h3>
            <p className="text-gray-600">
              El movimiento ha sido agregado exitosamente al flujo de caja.
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              <span className="font-medium text-blue-800">¿Ir a Ventas?</span>
            </div>
            <p className="text-sm text-blue-700">
              ¿Te gustaría ir a la página de ventas para procesar una venta?
            </p>
          </div>

          <div className="flex justify-center gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => setShowSuccessModal(false)}
            >
              Quedarme Aquí
            </Button>
            <Button
              onClick={() => {
                setShowSuccessModal(false);
                navigate('/sales');
              }}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
            >
              Ir a Ventas
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CashFlowPage;


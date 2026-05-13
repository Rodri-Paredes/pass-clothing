import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Building2,
  Package,
  ShoppingCart,
  DollarSign,
  Database,
  Clock,
  Layers,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { supabase } from '../lib/supabase';
import { useToastStore } from '../store/toastStore';
import { errorLogService, type ErrorLogEntry, type ErrorLevel } from '../services/errorLogService';

// ─── Types ──────────────────────────────────────────────────────────────────

interface HealthCheck {
  value: number;
  ok: boolean;
}

interface HealthResult {
  checked_at: string;
  status: 'ok' | 'warning' | 'critical';
  checks: {
    negative_stock: HealthCheck;
    orphan_stock: HealthCheck;
    orphan_sale_items: HealthCheck;
    products_no_variants: HealthCheck;
    duplicate_branches: HealthCheck;
    open_registers: HealthCheck;
    sales_no_register: HealthCheck;
  };
}

interface BranchStat {
  id: string;
  name: string;
  stock_units: number;
  total_sales: number;
  total_revenue: number;
  cash_register_open: boolean;
  cash_register_opened_at: string | null;
}

interface SystemStats {
  generated_at: string;
  totals: {
    products: number;
    variants: number;
    stock_units: number;
    sales: number;
    revenue: number;
  };
  branches: BranchStat[];
}

const LEVEL_STYLES: Record<ErrorLevel, string> = {
  critical: 'bg-red-100 text-red-800 border-red-300',
  error:    'bg-orange-50 text-orange-800 border-orange-300',
  warning:  'bg-yellow-50 text-yellow-800 border-yellow-300',
};

const CATEGORY_LABELS: Record<string, string> = {
  sale:         'Venta',
  stock:        'Stock',
  cash_register:'Caja',
  sync:         'Sync',
  rpc:          'RPC',
  permission:   'Permiso',
  auth:         'Auth',
  inconsistency:'Integridad',
  unknown:      'Otro',
};

const CHECK_LABELS: Record<string, string> = {
  negative_stock: 'Stock negativo',
  orphan_stock: 'Stock sin variante',
  orphan_sale_items: 'Ítems de venta huérfanos',
  products_no_variants: 'Productos sin variantes',
  duplicate_branches: 'Sucursales duplicadas',
  open_registers: 'Caja abierta',
  sales_no_register: 'Ventas sin caja',
};

const CHECK_DESCRIPTIONS: Record<string, string> = {
  negative_stock: 'Entradas de stock con cantidad menor a cero',
  orphan_stock: 'Registros de stock apuntando a variantes inexistentes',
  orphan_sale_items: 'Ítems de ventas con variante borrada',
  products_no_variants: 'Productos que no tienen ninguna talla/variante',
  duplicate_branches: 'Sucursales con el mismo nombre (puede causar problemas)',
  open_registers: 'Al menos una caja abierta por sucursal (esperado: ≥1)',
  sales_no_register: 'Ventas registradas fuera de una sesión de caja',
};

const formatCurrency = (n: number) =>
  `Bs ${n.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('es-BO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/La_Paz',
  });

// ─── Sub-components ──────────────────────────────────────────────────────────

const ErrorLogRow: React.FC<{ entry: ErrorLogEntry }> = ({ entry }) => (
  <div className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border text-xs ${LEVEL_STYLES[entry.level]}`}>
    <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
    <div className="flex-1 min-w-0">
      <p className="font-medium truncate">{entry.message}</p>
      <p className="opacity-70 mt-0.5">
        {new Date(entry.timestamp).toLocaleString('es-BO', { timeZone: 'America/La_Paz' })}
        {' · '}
        {CATEGORY_LABELS[entry.category] ?? entry.category}
        {entry.branchId && ' · ' + entry.branchId.slice(0, 8)}
      </p>
    </div>
  </div>
);

const StatusBadge: React.FC<{ status: HealthResult['status'] }> = ({ status }) => {
  const config = {
    ok: { label: 'Sistema OK', cls: 'bg-green-100 text-green-800 border-green-300', Icon: CheckCircle },
    warning: { label: 'Advertencia', cls: 'bg-yellow-100 text-yellow-800 border-yellow-300', Icon: AlertTriangle },
    critical: { label: 'CRÍTICO', cls: 'bg-red-100 text-red-800 border-red-300', Icon: XCircle },
  }[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-sm font-semibold ${config.cls}`}>
      <config.Icon className="h-4 w-4" />
      {config.label}
    </span>
  );
};

const CheckRow: React.FC<{ name: string; check: HealthCheck }> = ({ name, check }) => {
  const isInverted = name === 'open_registers'; // "ok" means value > 0
  const isOk = check.ok;
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="mt-0.5">
        {isOk ? (
          <CheckCircle className="h-5 w-5 text-green-500" />
        ) : (
          <XCircle className="h-5 w-5 text-red-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{CHECK_LABELS[name]}</p>
        <p className="text-xs text-gray-500">{CHECK_DESCRIPTIONS[name]}</p>
      </div>
      <div className={`text-sm font-bold tabular-nums ${isOk ? 'text-green-600' : 'text-red-600'}`}>
        {isInverted ? (check.value > 0 ? `${check.value} abierta(s)` : 'Ninguna') : check.value}
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string | number; icon: React.ReactNode; accent?: string }> = ({
  label, value, icon, accent = 'bg-blue-50 text-blue-600',
}) => (
  <Card padding="sm">
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-lg ${accent}`}>{icon}</div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  </Card>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

const HealthDashboardPage: React.FC = () => {
  const addToast = useToastStore((s) => s.addToast);
  const [health, setHealth] = useState<HealthResult | null>(null);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorLog, setErrorLog] = useState<ErrorLogEntry[]>(() => errorLogService.getRecent(50));

  const runChecks = useCallback(async () => {
    setIsLoading(true);
    try {
      const [healthRes, statsRes] = await Promise.all([
        supabase.rpc('run_health_check'),
        supabase.rpc('get_system_stats'),
      ]);

      if (healthRes.error) throw healthRes.error;
      if (statsRes.error) throw statsRes.error;

      setHealth(healthRes.data as HealthResult);
      setStats(statsRes.data as SystemStats);
    } catch (err: any) {
      console.error('Health check error:', err);
      addToast(
        err?.message?.includes('does not exist')
          ? 'Las funciones de health check no están instaladas. Ejecuta la migración SQL primero.'
          : `Error al obtener diagnóstico: ${err?.message}`,
        'error',
        8000
      );
    } finally {
      setIsLoading(false);
      // Refresh error log display after each check
      setErrorLog(errorLogService.getRecent(50));
    }
  }, [addToast]);

  useEffect(() => {
    runChecks();
  }, [runChecks]);

  const overallStatus = health?.status ?? null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Activity className="h-7 w-7 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Diagnóstico del Sistema</h1>
            {health && (
              <p className="text-xs text-gray-400">
                Última verificación: {formatDate(health.checked_at)}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {overallStatus && <StatusBadge status={overallStatus} />}
          <Button
            variant="secondary"
            size="sm"
            onClick={runChecks}
            isLoading={isLoading}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Migrations notice (only when functions are missing) */}
      {!isLoading && !health && (
        <Card>
          <div className="p-6 text-center space-y-3">
            <Database className="h-10 w-10 text-gray-400 mx-auto" />
            <p className="text-gray-600 font-medium">No se pudo conectar con las funciones de health check.</p>
            <p className="text-sm text-gray-500">
              Ejecuta el archivo <code className="bg-gray-100 px-1 rounded">supabase/migrations/20260513_health_checks.sql</code> en el Editor SQL de Supabase.
            </p>
          </div>
        </Card>
      )}

      {/* Global stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard
            label="Productos"
            value={stats.totals.products}
            icon={<Package className="h-5 w-5" />}
            accent="bg-purple-50 text-purple-600"
          />
          <StatCard
            label="Variantes"
            value={stats.totals.variants}
            icon={<Layers className="h-5 w-5" />}
            accent="bg-indigo-50 text-indigo-600"
          />
          <StatCard
            label="Unidades en stock"
            value={stats.totals.stock_units.toLocaleString()}
            icon={<Package className="h-5 w-5" />}
            accent="bg-blue-50 text-blue-600"
          />
          <StatCard
            label="Ventas totales"
            value={stats.totals.sales.toLocaleString()}
            icon={<ShoppingCart className="h-5 w-5" />}
            accent="bg-green-50 text-green-600"
          />
          <StatCard
            label="Ingresos totales"
            value={formatCurrency(stats.totals.revenue)}
            icon={<DollarSign className="h-5 w-5" />}
            accent="bg-emerald-50 text-emerald-600"
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Integrity checks */}
        <Card>
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Database className="h-5 w-5 text-blue-600" />
              Integridad de datos
            </h2>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="h-12 rounded-lg bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : health ? (
              <div>
                {Object.entries(health.checks).map(([name, check]) => (
                  <CheckRow key={name} name={name} check={check} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 py-4 text-center">Sin datos</p>
            )}
          </div>
        </Card>

        {/* Branch stats */}
        <Card>
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              Estado por sucursal
            </h2>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-24 rounded-lg bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : stats && stats.branches.length > 0 ? (
              <div className="space-y-4">
                {stats.branches.map((branch) => (
                  <div key={branch.id} className="rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-800">{branch.name}</h3>
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                          branch.cash_register_open
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        <Clock className="h-3 w-3" />
                        {branch.cash_register_open ? 'Caja abierta' : 'Caja cerrada'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-lg font-bold text-gray-900">{branch.stock_units.toLocaleString()}</p>
                        <p className="text-xs text-gray-500">Unidades</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-gray-900">{branch.total_sales.toLocaleString()}</p>
                        <p className="text-xs text-gray-500">Ventas</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-gray-900">
                          {formatCurrency(branch.total_revenue)}
                        </p>
                        <p className="text-xs text-gray-500">Ingresos</p>
                      </div>
                    </div>
                    {branch.cash_register_open && branch.cash_register_opened_at && (
                      <p className="text-xs text-gray-400 mt-2">
                        Abierta desde: {formatDate(branch.cash_register_opened_at)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 py-4 text-center">Sin datos de sucursales</p>
            )}
          </div>
        </Card>
      </div>

      {/* Error Log */}
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-500" />
              Registro de errores operacionales
            </h2>
            <div className="flex items-center gap-2">
              {errorLog.length > 0 && (
                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                  {errorLog.length} evento{errorLog.length !== 1 ? 's' : ''}
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  errorLogService.clearLocal();
                  setErrorLog([]);
                  addToast('Registro de errores limpiado', 'success', 3000);
                }}
                className="flex items-center gap-1 text-gray-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Limpiar
              </Button>
            </div>
          </div>
          {errorLog.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Sin errores registrados en esta sesión</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
              {errorLog.map((entry) => (
                <ErrorLogRow key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default HealthDashboardPage;

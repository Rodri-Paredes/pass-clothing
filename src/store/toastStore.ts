import { create } from 'zustand';
import { errorLogService, type ErrorCategory } from '../services/errorLogService';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

// Context passed to notify() for operational alerts
export interface NotifyContext {
  category?: ErrorCategory;
  userId?: string;
  branchId?: string;
  details?: Record<string, unknown>;
  /** Override auto-dismiss duration in ms (0 = sticky) */
  duration?: number;
}

// Predefined operational alert shortcuts
export type OperationalAlert =
  | 'sale_failed'
  | 'stock_insufficient'
  | 'cash_register_closed'
  | 'rpc_failure'
  | 'sync_error'
  | 'permission_denied'
  | 'operation_blocked'
  | 'inconsistency_detected';

const ALERT_CONFIG: Record<
  OperationalAlert,
  { type: ToastType; category: ErrorCategory; duration: number; prefix: string }
> = {
  sale_failed:             { type: 'error',   category: 'sale',          duration: 6000, prefix: 'Venta fallida' },
  stock_insufficient:      { type: 'warning', category: 'stock',         duration: 5000, prefix: 'Stock insuficiente' },
  cash_register_closed:    { type: 'error',   category: 'cash_register', duration: 0,    prefix: 'Caja cerrada' },
  rpc_failure:             { type: 'error',   category: 'rpc',           duration: 6000, prefix: 'Error de servidor' },
  sync_error:              { type: 'warning', category: 'sync',          duration: 5000, prefix: 'Error de sincronización' },
  permission_denied:       { type: 'error',   category: 'permission',    duration: 5000, prefix: 'Sin permisos' },
  operation_blocked:       { type: 'warning', category: 'unknown',       duration: 5000, prefix: 'Operación bloqueada' },
  inconsistency_detected:  { type: 'error',   category: 'inconsistency', duration: 0,    prefix: 'Inconsistencia detectada' },
};

interface ToastState {
  toasts: Toast[];
  addToast: (message: string, type?: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
  /**
   * Operational alert: shows a toast AND logs the error for audit.
   * Use this instead of addToast for any business-critical failure.
   */
  notify: (alert: OperationalAlert, detail: string, ctx?: NotifyContext) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (message, type = 'info', duration = 4000) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    set((state) => ({
      toasts: [...state.toasts, { id, message, type, duration }],
    }));
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, duration);
    }
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  notify: (alert, detail, ctx = {}) => {
    const config = ALERT_CONFIG[alert];
    const category = ctx.category ?? config.category;
    const duration = ctx.duration !== undefined ? ctx.duration : config.duration;
    const message = `${config.prefix}: ${detail}`;

    // 1. Show toast
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    set((state) => ({
      toasts: [...state.toasts, { id, message, type: config.type, duration }],
    }));
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
      }, duration);
    }

    // 2. Log to error registry (localStorage + Supabase)
    const level = config.type === 'warning' ? 'warning' : 'error';
    errorLogService.log(level, category, message, {
      details: ctx.details,
      userId: ctx.userId,
      branchId: ctx.branchId,
    });
  },
}));


import React, { useEffect, useRef } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useToastStore, type Toast } from '../../store/toastStore';

const ICONS = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const STYLES = {
  success: 'bg-green-50 border-green-400 text-green-800',
  error: 'bg-red-50 border-red-400 text-red-800',
  warning: 'bg-yellow-50 border-yellow-400 text-yellow-800',
  info: 'bg-blue-50 border-blue-400 text-blue-800',
};

const ICON_STYLES = {
  success: 'text-green-500',
  error: 'text-red-500',
  warning: 'text-yellow-500',
  info: 'text-blue-500',
};

const ToastItem: React.FC<{ toast: Toast }> = ({ toast }) => {
  const removeToast = useToastStore((s) => s.removeToast);
  const Icon = ICONS[toast.type];
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!progressRef.current || toast.duration <= 0) return;
    const el = progressRef.current;
    el.style.transition = `width ${toast.duration}ms linear`;
    // Force reflow before starting transition
    void el.offsetWidth;
    el.style.width = '0%';
  }, [toast.duration]);

  return (
    <div
      className={`flex items-start gap-3 w-full max-w-sm rounded-xl border px-4 py-3 shadow-lg pointer-events-auto relative overflow-hidden ${STYLES[toast.type]}`}
      role="alert"
    >
      <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${ICON_STYLES[toast.type]}`} />
      <p className="flex-1 text-sm font-medium leading-snug">{toast.message}</p>
      <button
        onClick={() => removeToast(toast.id)}
        className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Cerrar"
      >
        <X className="h-4 w-4" />
      </button>
      {toast.duration > 0 && (
        <div className="absolute bottom-0 left-0 h-0.5 w-full bg-current opacity-20">
          <div
            ref={progressRef}
            className="h-full bg-current opacity-60"
            style={{ width: '100%' }}
          />
        </div>
      )}
    </div>
  );
};

const ToastContainer: React.FC = () => {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed top-4 right-4 z-50 flex flex-col gap-2 items-end pointer-events-none"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
};

export default ToastContainer;

import React, { useEffect, useRef } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useToastStore, type Toast } from '../../store/toastStore';

const CONFIG = {
  success: {
    icon: CheckCircle,
    base: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    icon_: 'text-emerald-500',
    progress: 'bg-emerald-400',
  },
  error: {
    icon: XCircle,
    base: 'bg-red-50 border-red-200 text-red-900',
    icon_: 'text-red-500',
    progress: 'bg-red-400',
  },
  warning: {
    icon: AlertTriangle,
    base: 'bg-amber-50 border-amber-200 text-amber-900',
    icon_: 'text-amber-500',
    progress: 'bg-amber-400',
  },
  info: {
    icon: Info,
    base: 'bg-blue-50 border-blue-200 text-blue-900',
    icon_: 'text-blue-500',
    progress: 'bg-blue-400',
  },
};

const ToastItem: React.FC<{ toast: Toast }> = ({ toast }) => {
  const removeToast = useToastStore((s) => s.removeToast);
  const { icon: Icon, base, icon_, progress } = CONFIG[toast.type];
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!progressRef.current || toast.duration <= 0) return;
    const el = progressRef.current;
    el.style.transition = `width ${toast.duration}ms linear`;
    void el.offsetWidth;
    el.style.width = '0%';
  }, [toast.duration]);

  return (
    <div
      className={`flex items-start gap-3 w-full max-w-sm rounded-xl border px-4 py-3 shadow-lg pointer-events-auto relative overflow-hidden ${base} animate-slide-in-right`}
      role="alert"
    >
      <Icon className={`h-4.5 w-4.5 mt-0.5 shrink-0 ${icon_}`} style={{ width: '1.0625rem', height: '1.0625rem' }} />
      <p className="flex-1 text-sm font-medium leading-snug">{toast.message}</p>
      <button
        onClick={() => removeToast(toast.id)}
        className="shrink-0 p-0.5 rounded opacity-50 hover:opacity-100 hover:bg-black/8 transition-all"
        aria-label="Cerrar"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      {toast.duration > 0 && (
        <div className="absolute bottom-0 left-0 h-[2px] w-full bg-black/6">
          <div ref={progressRef} className={`h-full ${progress} opacity-70`} style={{ width: '100%' }} />
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
      className="fixed top-4 right-4 z-[100] flex flex-col gap-2 items-end pointer-events-none w-80"
    >
      {toasts.map((t) => <ToastItem key={t.id} toast={t} />)}
    </div>
  );
};

export default ToastContainer;

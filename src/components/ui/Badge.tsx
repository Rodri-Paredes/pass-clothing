import React from 'react';

type BadgeVariant =
  | 'default'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'purple'
  | 'neutral';

type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  className?: string;
}

const VARIANTS: Record<BadgeVariant, string> = {
  default:  'bg-surface-100 text-surface-700',
  neutral:  'bg-surface-100 text-surface-600',
  primary:  'bg-brand-50 text-brand-700 ring-1 ring-brand-200',
  success:  'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  warning:  'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  danger:   'bg-red-50 text-red-700 ring-1 ring-red-200',
  info:     'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  purple:   'bg-purple-50 text-purple-700 ring-1 ring-purple-200',
};

const DOT_COLORS: Record<BadgeVariant, string> = {
  default:  'bg-surface-400',
  neutral:  'bg-surface-400',
  primary:  'bg-brand-500',
  success:  'bg-emerald-500',
  warning:  'bg-amber-500',
  danger:   'bg-red-500',
  info:     'bg-blue-500',
  purple:   'bg-purple-500',
};

const SIZES: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-2xs gap-1',
  md: 'px-2.5 py-1 text-xs gap-1.5',
};

const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  className = '',
}) => (
  <span
    className={`inline-flex items-center rounded-full font-medium ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
  >
    {dot && (
      <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${DOT_COLORS[variant]}`} />
    )}
    {children}
  </span>
);

export default Badge;

/* ─── Preset badges for common states ─── */

export const PaymentBadge: React.FC<{ type: string }> = ({ type }) => {
  const map: Record<string, { label: string; variant: BadgeVariant }> = {
    EFECTIVO: { label: 'Efectivo', variant: 'success'  },
    QR:       { label: 'QR',       variant: 'info'     },
    TARJETA:  { label: 'Tarjeta',  variant: 'primary'  },
    MIXTO:    { label: 'Mixto',    variant: 'purple'   },
  };
  const cfg = map[type] ?? { label: type, variant: 'neutral' as BadgeVariant };
  return <Badge variant={cfg.variant} dot size="sm">{cfg.label}</Badge>;
};

export const StockBadge: React.FC<{ qty: number }> = ({ qty }) => {
  if (qty === 0)
    return <Badge variant="danger" dot size="sm">Sin stock</Badge>;
  if (qty <= 3)
    return <Badge variant="warning" dot size="sm">{qty} un.</Badge>;
  if (qty <= 10)
    return <Badge variant="info" size="sm">{qty} un.</Badge>;
  return <Badge variant="success" size="sm">{qty} un.</Badge>;
};

export const RoleBadge: React.FC<{ role: string }> = ({ role }) => (
  <Badge variant={role === 'admin' ? 'primary' : 'neutral'} size="sm">
    {role === 'admin' ? 'Admin' : 'Vendedor'}
  </Badge>
);

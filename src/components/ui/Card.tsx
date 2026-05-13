import React from 'react';

type CardVariant = 'default' | 'bordered' | 'flat' | 'elevated';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  variant?: CardVariant;
  hover?: boolean;
  onClick?: () => void;
}

const Card: React.FC<CardProps> = ({
  children,
  className = '',
  padding = 'md',
  variant = 'default',
  hover = false,
  onClick,
}) => {
  const base = 'bg-white rounded-xl';

  const variants: Record<CardVariant, string> = {
    default:  'border border-surface-200 shadow-card',
    bordered: 'border-2 border-surface-200',
    flat:     'border border-surface-100',
    elevated: 'shadow-md border border-surface-100',
  };

  const pads: Record<string, string> = {
    none: '',
    sm:   'p-4',
    md:   'p-5',
    lg:   'p-6',
  };

  const interactive = (hover || onClick)
    ? 'cursor-pointer hover:shadow-card-hover hover:border-surface-300 transition-all duration-200 active:scale-[0.995]'
    : '';

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      className={`${base} ${variants[variant]} ${pads[padding]} ${interactive} ${className}`}
    >
      {children}
    </div>
  );
};

export default Card;
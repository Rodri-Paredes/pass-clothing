import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'success';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  iconRight,
  className = '',
  disabled,
  ...props
}) => {
  const base = [
    'inline-flex items-center justify-center font-medium rounded-lg',
    'transition-all duration-150 ease-smooth',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
    'disabled:pointer-events-none disabled:opacity-50',
    'select-none relative',
  ].join(' ');

  const variants: Record<string, string> = {
    primary: [
      'bg-brand-600 text-white shadow-sm',
      'hover:bg-brand-700 active:bg-brand-800',
      'hover:shadow-md active:scale-[0.98]',
    ].join(' '),
    secondary: [
      'bg-surface-800 text-white shadow-sm',
      'hover:bg-surface-900 active:bg-black',
      'hover:shadow-md active:scale-[0.98]',
    ].join(' '),
    danger: [
      'bg-red-600 text-white shadow-sm',
      'hover:bg-red-700 active:bg-red-800',
      'hover:shadow-md active:scale-[0.98]',
    ].join(' '),
    success: [
      'bg-emerald-600 text-white shadow-sm',
      'hover:bg-emerald-700 active:bg-emerald-800',
      'active:scale-[0.98]',
    ].join(' '),
    outline: [
      'border border-surface-300 bg-white text-surface-700 shadow-xs',
      'hover:bg-surface-50 hover:border-surface-400 active:bg-surface-100',
      'active:scale-[0.98]',
    ].join(' '),
    ghost: [
      'bg-transparent text-surface-600',
      'hover:bg-surface-100 hover:text-surface-900 active:bg-surface-200',
    ].join(' '),
  };

  const sizes: Record<string, string> = {
    xs: 'px-2.5 py-1   text-xs  gap-1.5',
    sm: 'px-3   py-1.5 text-sm  gap-1.5',
    md: 'px-4   py-2   text-sm  gap-2',
    lg: 'px-5   py-2.5 text-base gap-2',
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <svg
          className="animate-spin h-3.5 w-3.5 flex-shrink-0"
          fill="none" viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : icon ? (
        <span className="flex-shrink-0 -ml-0.5">{icon}</span>
      ) : null}
      {children && <span>{children}</span>}
      {iconRight && !isLoading && <span className="flex-shrink-0 -mr-0.5">{iconRight}</span>}
    </button>
  );
};

export default Button;
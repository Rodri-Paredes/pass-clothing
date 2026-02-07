import React from 'react';

interface DiscountBadgeProps {
  percentage: number;
  size?: 'sm' | 'md' | 'lg';
}

/** Badge "-XX%" que se muestra sobre los productos con descuento */
export const DiscountBadge: React.FC<DiscountBadgeProps> = ({ percentage, size = 'md' }) => {
  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2 py-0.5',
    lg: 'text-sm px-2.5 py-1',
  };

  return (
    <span
      className={`inline-flex items-center font-bold rounded-full bg-red-500 text-white ${sizeClasses[size]}`}
    >
      -{percentage}%
    </span>
  );
};

interface DiscountPriceProps {
  originalPrice: number;
  percentage: number;
  showBadge?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

/** Muestra precio original tachado + precio con descuento + badge */
export const DiscountPrice: React.FC<DiscountPriceProps> = ({
  originalPrice,
  percentage,
  showBadge = true,
  size = 'md',
}) => {
  const discountedPrice = originalPrice - (originalPrice * percentage / 100);

  const sizeClasses = {
    sm: {
      original: 'text-xs',
      discounted: 'text-sm font-bold',
    },
    md: {
      original: 'text-sm',
      discounted: 'text-lg font-bold',
    },
    lg: {
      original: 'text-base',
      discounted: 'text-xl font-bold',
    },
  };

  const classes = sizeClasses[size];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className={`line-through text-gray-400 ${classes.original}`}>
        ${originalPrice.toFixed(2)}
      </span>
      <span className={`text-red-600 ${classes.discounted}`}>
        ${discountedPrice.toFixed(2)}
      </span>
      {showBadge && <DiscountBadge percentage={percentage} size={size === 'lg' ? 'md' : 'sm'} />}
    </div>
  );
};

export default DiscountBadge;

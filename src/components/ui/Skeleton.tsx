import React from 'react';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
  lines?: number;
  gap?: string;
}

/** Single shimmer block */
const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  rounded = 'md',
  lines,
  gap = 'gap-2',
}) => {
  const radii = { sm: 'rounded', md: 'rounded-lg', lg: 'rounded-xl', full: 'rounded-full' };

  if (lines && lines > 1) {
    return (
      <div className={`flex flex-col ${gap}`}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={`skeleton h-4 ${radii[rounded]} ${i === lines - 1 ? 'w-3/4' : 'w-full'} ${className}`}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={`skeleton ${radii[rounded]} ${className}`} />
  );
};

export default Skeleton;

/* ─── Compound skeletons for common patterns ─── */

export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`bg-white rounded-xl border border-surface-200 p-5 ${className}`}>
    <div className="flex items-start gap-3">
      <Skeleton className="h-10 w-10 flex-shrink-0" rounded="lg" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  </div>
);

export const SkeletonStatGrid: React.FC = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    {[0, 1, 2].map(i => <SkeletonCard key={i} />)}
  </div>
);

export const SkeletonTableRows: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 6,
  cols = 5,
}) => (
  <div className="space-y-0">
    {Array.from({ length: rows }).map((_, r) => (
      <div key={r} className="flex items-center gap-4 px-4 py-3 border-b border-surface-100">
        {Array.from({ length: cols }).map((_, c) => (
          <Skeleton
            key={c}
            className={`h-4 ${c === 0 ? 'w-6' : c === cols - 1 ? 'w-16' : 'flex-1'}`}
          />
        ))}
      </div>
    ))}
  </div>
);

export const SkeletonProductCard: React.FC = () => (
  <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
    <Skeleton className="h-40 w-full" rounded="sm" />
    <div className="p-3 space-y-2">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      <div className="flex gap-1 pt-1">
        {[0,1,2].map(i => <Skeleton key={i} className="h-6 w-8" rounded="full" />)}
      </div>
    </div>
  </div>
);

import React, { useEffect, useState } from 'react';
import { Star, Package, Filter } from 'lucide-react';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { dropsService } from '../../services/dropsService';
import type { Drop } from '../../lib/types';

interface DropFilterProps {
  selectedDropId: string | null;
  onDropChange: (dropId: string | null) => void;
  className?: string;
}

export const DropFilter: React.FC<DropFilterProps> = ({
  selectedDropId,
  onDropChange,
  className = ''
}) => {
  const [drops, setDrops] = useState<Drop[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadDrops = async () => {
      try {
        setIsLoading(true);
        const activeDrops = await dropsService.getActiveDrops();
        setDrops(activeDrops);
      } catch (error) {
        console.error('Error loading drops:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDrops();
  }, []);

  if (isLoading) {
    return (
      <div className={`space-y-3 ${className}`}>
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Filter className="h-4 w-4" />
          Filtrar por Drop
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="h-8 w-20 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-8 w-24 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-8 w-16 bg-gray-200 rounded animate-pulse"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <Filter className="h-4 w-4" />
        Filtrar por Drop
      </div>
      
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={selectedDropId === null ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => onDropChange(null)}
          className="text-xs"
        >
          Todos
        </Button>
        
        {drops.map((drop) => (
          <Button
            key={drop.id}
            variant={selectedDropId === drop.id ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => onDropChange(drop.id)}
            className="text-xs flex items-center gap-1"
          >
            {drop.is_featured && <Star className="h-3 w-3 fill-current" />}
            <span className="truncate max-w-20">{drop.name}</span>
          </Button>
        ))}
      </div>
    </div>
  );
};

interface DropBadgeProps {
  drop: Drop | null;
  className?: string;
}

export const DropBadge: React.FC<DropBadgeProps> = ({ drop, className = '' }) => {
  if (!drop) return null;

  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 ${className}`}>
      <Package className="h-3 w-3" />
      {drop.is_featured && <Star className="h-3 w-3 fill-current text-yellow-500" />}
      <span className="truncate">{drop.name}</span>
    </div>
  );
};

interface DropInfoCardProps {
  drop: Drop;
  onClose?: () => void;
  className?: string;
}

export const DropInfoCard: React.FC<DropInfoCardProps> = ({ 
  drop, 
  onClose, 
  className = '' 
}) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVO': return 'bg-green-100 text-green-800';
      case 'INACTIVO': return 'bg-yellow-100 text-yellow-800';
      case 'FINALIZADO': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card className={`relative ${className}`}>
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
        >
          ×
        </button>
      )}
      
      <div className="space-y-4">
        <div className="flex items-start gap-4">
          {drop.image_url && (
            <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
              <img 
                src={drop.image_url} 
                alt={drop.name}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-gray-900 truncate">{drop.name}</h3>
              {drop.is_featured && (
                <Star className="h-4 w-4 text-yellow-500 fill-current flex-shrink-0" />
              )}
            </div>
            
            <p className="text-sm text-gray-600 line-clamp-2 mb-2">
              {drop.description}
            </p>
            
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(drop.status)}`}>
                {drop.status}
              </span>
              {drop.product_count && (
                <span className="text-xs text-gray-500">
                  {drop.product_count} productos
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="text-xs text-gray-500 space-y-1">
          <div>Lanzamiento: {formatDate(drop.launch_date)}</div>
          {drop.end_date && (
            <div>Finaliza: {formatDate(drop.end_date)}</div>
          )}
        </div>
      </div>
    </Card>
  );
};

export default DropFilter;

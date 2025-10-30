import React, { useEffect, useState } from 'react';
import { Star, Package, Calendar, ArrowRight } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { dropsService } from '../../services/dropsService';
import type { Drop, DropProduct } from '../../lib/types';

interface FeaturedDropsSectionProps {
  className?: string;
}

export const FeaturedDropsSection: React.FC<FeaturedDropsSectionProps> = ({ className = '' }) => {
  const [featuredDrops, setFeaturedDrops] = useState<Drop[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<DropProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadFeaturedContent = async () => {
      try {
        setIsLoading(true);
        const [drops, products] = await Promise.all([
          dropsService.getFeaturedDrops(),
          dropsService.getFeaturedProductsFromDrops()
        ]);
        
        setFeaturedDrops(drops.slice(0, 3)); // Mostrar solo los primeros 3
        setFeaturedProducts(products.slice(0, 6)); // Mostrar solo los primeros 6 productos
      } catch (error) {
        console.error('Error loading featured content:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadFeaturedContent();
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      month: 'short',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Drops Destacados</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <div className="h-32 bg-gray-200 rounded-lg mb-4"></div>
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-2/3"></div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (featuredDrops.length === 0 && featuredProducts.length === 0) {
    return null; // No mostrar la sección si no hay contenido destacado
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <Star className="h-5 w-5 text-yellow-500 fill-current" />
          Drops Destacados
        </h2>
        <Button variant="ghost" size="sm" onClick={() => window.location.href = '/drops'}>
          Ver todos
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      {/* Featured Drops */}
      {featuredDrops.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-800">Colecciones Activas</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {featuredDrops.map((drop) => (
              <Card key={drop.id} className="hover:shadow-lg transition-all duration-200 cursor-pointer group">
                <div className="relative">
                  {drop.image_url ? (
                    <div className="aspect-video bg-gray-100 rounded-lg mb-4 overflow-hidden">
                      <img 
                        src={drop.image_url} 
                        alt={drop.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video bg-gradient-to-br from-blue-100 to-purple-100 rounded-lg mb-4 flex items-center justify-center">
                      <Package className="h-8 w-8 text-blue-600" />
                    </div>
                  )}
                  
                  <div className="absolute top-2 right-2">
                    <div className="bg-yellow-400 text-yellow-900 px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                      <Star className="h-3 w-3 fill-current" />
                      Destacado
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-semibold text-gray-900 truncate">{drop.name}</h4>
                  <p className="text-sm text-gray-600 line-clamp-2">{drop.description}</p>
                  
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Calendar className="h-3 w-3" />
                    <span>Lanzado {formatDate(drop.launch_date)}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Package className="h-3 w-3" />
                    <span>{drop.product_count || 0} productos</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Featured Products */}
      {featuredProducts.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-800">Productos Destacados</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {featuredProducts.map((dropProduct) => {
              const product = dropProduct.product;
              if (!product) return null;

              return (
                <Card key={dropProduct.id} className="hover:shadow-lg transition-all duration-200 cursor-pointer group">
                  <div className="relative">
                    {product.image_url ? (
                      <div className="aspect-square bg-gray-100 rounded-lg mb-3 overflow-hidden">
                        <img 
                          src={product.image_url} 
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      </div>
                    ) : (
                      <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg mb-3 flex items-center justify-center">
                        <Package className="h-6 w-6 text-gray-400" />
                      </div>
                    )}
                    
                    <div className="absolute top-1 right-1">
                      <div className="bg-yellow-400 text-yellow-900 px-1.5 py-0.5 rounded-full text-xs font-semibold">
                        <Star className="h-2 w-2 fill-current" />
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <h5 className="font-medium text-gray-900 text-sm truncate">{product.name}</h5>
                    <p className="text-xs text-gray-600 truncate">{product.category}</p>
                    <p className="text-sm font-semibold text-blue-600">${product.price.toFixed(2)}</p>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default FeaturedDropsSection;

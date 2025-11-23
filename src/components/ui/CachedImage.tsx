/**
 * Componente de imagen optimizado con caché local
 * Reduce el Cached Egress de Supabase almacenando imágenes en IndexedDB
 */

import { useState, useEffect } from 'react';
import { imageCacheManager } from '../../lib/imageCache';

interface CachedImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackSrc?: string;
  placeholder?: string;
  loading?: 'lazy' | 'eager';
  onLoad?: () => void;
  onError?: () => void;
}

export default function CachedImage({
  src,
  alt,
  className = '',
  fallbackSrc = '/placeholder-image.png',
  placeholder = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"%3E%3Crect fill="%23f3f4f6" width="400" height="300"/%3E%3Ctext fill="%239ca3af" x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="18"%3ECargando...%3C/text%3E%3C/svg%3E',
  loading = 'lazy',
  onLoad,
  onError
}: CachedImageProps) {
  const [imageSrc, setImageSrc] = useState<string>(placeholder);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let mounted = true;
    let objectUrl: string | null = null;

    const loadImage = async () => {
      if (!src) {
        setImageSrc(fallbackSrc);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setHasError(false);

        // Obtener imagen desde caché o descargarla
        objectUrl = await imageCacheManager.getImage(src);

        if (mounted && objectUrl) {
          setImageSrc(objectUrl);
          setIsLoading(false);
          onLoad?.();
        }
      } catch (error) {
        console.error('Error loading cached image:', error);
        
        if (mounted) {
          setImageSrc(fallbackSrc);
          setHasError(true);
          setIsLoading(false);
          onError?.();
        }
      }
    };

    loadImage();

    // Cleanup: liberar object URL cuando el componente se desmonte
    return () => {
      mounted = false;
      if (objectUrl && objectUrl.startsWith('blob:')) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [src, fallbackSrc, onLoad, onError]);

  return (
    <img
      src={imageSrc}
      alt={alt}
      className={`${className} ${isLoading ? 'animate-pulse' : ''}`}
      loading={loading}
      decoding="async"
      onError={() => {
        if (!hasError) {
          setImageSrc(fallbackSrc);
          setHasError(true);
          onError?.();
        }
      }}
    />
  );
}

/**
 * Hook para pre-cargar múltiples imágenes
 */
export function usePreloadImages(urls: string[]) {
  useEffect(() => {
    if (urls.length > 0) {
      imageCacheManager.preloadImages(urls);
    }
  }, [urls]);
}

/**
 * Hook para obtener estadísticas de caché
 */
export function useImageCacheStats() {
  const [stats, setStats] = useState<{ count: number; totalSize: number } | null>(null);

  useEffect(() => {
    imageCacheManager.getStats().then(setStats);
  }, []);

  return stats;
}

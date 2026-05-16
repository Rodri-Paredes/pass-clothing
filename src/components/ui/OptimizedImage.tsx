/**
 * 🖼️ OptimizedImage Component
 * Componente para cargar imágenes optimizadas con:
 * - Lazy loading nativo
 * - Placeholder mientras carga
 * - Transformaciones de Supabase Storage
 * - Fallback en caso de error
 * 
 * Uso:
 * ```tsx
 * <OptimizedImage
 *   src={product.image_url}
 *   alt={product.name}
 *   width={400}
 *   className="rounded-lg"
 * />
 * ```
 */

import React, { useState } from 'react';

// Helper simple para combinar classnames
function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

interface OptimizedImageProps {
  src: string | null | undefined;
  alt: string;
  width?: number; // Ancho deseado para optimización
  quality?: number; // Calidad (1-100)
  className?: string;
  fallbackSrc?: string; // Imagen por defecto si falla
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
}

/**
 * Transforma una URL de Supabase Storage para pasarla por images.weserv.nl
 * CDN gratuito que cachea globalmente y convierte a WebP — elimina egress de Supabase.
 */
function getOptimizedImageUrl(
  url: string | null | undefined,
  width?: number,
  quality: number = 80
): string | null {
  if (!url) return null;

  if (url.includes('supabase.co/storage/v1/object/public/')) {
    const urlSinProtocolo = url.replace(/^https?:\/\//, '');
    const w = width || 800;
    return `https://images.weserv.nl/?url=${encodeURIComponent(urlSinProtocolo)}&w=${w}&q=${quality}&output=webp&il`;
  }

  return url;
}

/**
 * Componente de imagen optimizada
 */
export function OptimizedImage({
  src,
  alt,
  width = 400,
  quality = 80,
  className,
  fallbackSrc = 'https://via.placeholder.com/400x400?text=Sin+Imagen',
  objectFit = 'cover',
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Obtener URL optimizada
  const optimizedUrl = getOptimizedImageUrl(src, width, quality);
  const finalSrc = hasError ? fallbackSrc : optimizedUrl || fallbackSrc;

  return (
    <div className={cn('relative overflow-hidden bg-gray-100', className)}>
      {/* Skeleton loader mientras carga */}
      {isLoading && (
        <div className="absolute inset-0 animate-pulse bg-gray-200" />
      )}

      {/* Imagen */}
      <img
        src={finalSrc}
        alt={alt}
        loading="lazy" // ✅ Lazy loading nativo
        decoding="async" // ✅ Decodificación asíncrona
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setHasError(true);
          setIsLoading(false);
        }}
        style={{
          objectFit,
          width: '100%',
          height: '100%',
          opacity: isLoading ? 0 : 1,
          transition: 'opacity 0.3s ease-in-out',
        }}
      />
    </div>
  );
}

/**
 * Variante con Picture para WebP con fallback
 * Más compatible con navegadores antiguos
 */
export function OptimizedPicture({
  src,
  alt,
  width = 400,
  quality = 80,
  className,
  fallbackSrc = 'https://via.placeholder.com/400x400?text=Sin+Imagen',
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const webpUrl = getOptimizedImageUrl(src, width, quality);
  const jpegUrl = src || fallbackSrc;
  const finalSrc = hasError ? fallbackSrc : jpegUrl;

  return (
    <div className={cn('relative overflow-hidden bg-gray-100', className)}>
      {isLoading && (
        <div className="absolute inset-0 animate-pulse bg-gray-200" />
      )}

      <picture>
        {/* WebP para navegadores modernos */}
        {webpUrl && !hasError && (
          <source type="image/webp" srcSet={webpUrl} />
        )}

        {/* Fallback JPEG/PNG */}
        <img
          src={finalSrc}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setHasError(true);
            setIsLoading(false);
          }}
          style={{
            objectFit: 'cover',
            width: '100%',
            height: '100%',
            opacity: isLoading ? 0 : 1,
            transition: 'opacity 0.3s ease-in-out',
          }}
        />
      </picture>
    </div>
  );
}

/**
 * Variante para avatar circular
 */
export function OptimizedAvatar({
  src,
  alt,
  size = 40,
  className,
}: {
  src: string | null | undefined;
  alt: string;
  size?: number;
  className?: string;
}) {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      width={size}
      className={cn('rounded-full', className)}
      objectFit="cover"
    />
  );
}

/**
 * Helper: Comprimir imagen antes de subirla
 * Usa browser-image-compression
 * 
 * Instalar: npm install browser-image-compression
 */
export async function compressImageFile(file: File): Promise<File> {
  // Lazy import para no cargar la librería si no se usa
  const imageCompression = (await import('browser-image-compression')).default;

  const options = {
    maxSizeMB: 0.5, // Máximo 500KB
    maxWidthOrHeight: 1200, // Máximo 1200px
    useWebWorker: true,
    fileType: 'image/webp', // Convertir a WebP
  };

  try {
    const compressed = await imageCompression(file, options);
    const sizeBefore = (file.size / 1024).toFixed(2);
    const sizeAfter = (compressed.size / 1024).toFixed(2);
    
    console.log(`🗜️ [ImageCompression] ${sizeBefore}KB → ${sizeAfter}KB`);
    
    return compressed;
  } catch (error) {
    console.error('❌ [ImageCompression] Error comprimiendo:', error);
    return file; // Devolver original si falla
  }
}

/**
 * Helper: Subir imagen optimizada a Supabase Storage
 */
export async function uploadOptimizedImage(
  file: File,
  bucket: string = 'products'
): Promise<string | null> {
  try {
    // 1. Comprimir imagen
    const compressed = await compressImageFile(file);

    // 2. Generar nombre único
    const timestamp = Date.now();
    const extension = compressed.name.split('.').pop();
    const filename = `${timestamp}_${Math.random().toString(36).substring(7)}.${extension}`;

    // 3. Subir a Supabase (necesitas importar supabase)
    const { supabase } = await import('../../lib/supabase');
    
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filename, compressed, {
        cacheControl: '3600', // Cachear por 1 hora
        upsert: false,
      });

    if (error) {
      console.error('❌ [ImageUpload] Error:', error);
      throw error;
    }

    // 4. Obtener URL pública
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    console.log('✅ [ImageUpload] Subida exitosa:', publicUrl);
    return publicUrl;
  } catch (error) {
    console.error('❌ [ImageUpload] Error general:', error);
    return null;
  }
}

/**
 * Hook personalizado para precargar imágenes (prefetch)
 */
export function usePrefetchImage(src: string | null | undefined) {
  React.useEffect(() => {
    if (!src) return;

    const img = new Image();
    img.src = src;
  }, [src]);
}

/**
 * Componente de galería con lazy loading progresivo
 */
export function ImageGallery({
  images,
  className,
}: {
  images: Array<{ src: string; alt: string }>;
  className?: string;
}) {
  return (
    <div className={cn('grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4', className)}>
      {images.map((img, index) => (
        <OptimizedImage
          key={index}
          src={img.src}
          alt={img.alt}
          width={300}
          className="aspect-square rounded-lg"
        />
      ))}
    </div>
  );
}

// ====================================
// EJEMPLOS DE USO
// ====================================

/*
// 1. En un componente de lista de productos:
<OptimizedImage
  src={product.image_url}
  alt={product.name}
  width={400}
  className="w-full h-64 rounded-lg"
/>

// 2. En Card de producto con efecto hover:
<div className="group relative">
  <OptimizedImage
    src={product.image_url}
    alt={product.name}
    width={500}
    quality={85}
    className="transition-transform group-hover:scale-105"
  />
</div>

// 3. Avatar de usuario:
<OptimizedAvatar
  src={user.avatar_url}
  alt={user.name}
  size={40}
/>

// 4. Al subir una imagen:
async function handleImageUpload(file: File) {
  const imageUrl = await uploadOptimizedImage(file, 'products');
  if (imageUrl) {
    // Guardar imageUrl en tu producto
  }
}

// 5. Prefetch en hover (anticipar carga):
function ProductCard({ product }) {
  usePrefetchImage(product.image_url);
  
  return (
    <Link to={`/product/${product.id}`}>
      <OptimizedImage src={product.image_url} alt={product.name} />
    </Link>
  );
}
*/

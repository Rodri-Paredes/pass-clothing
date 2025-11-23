/**
 * Sistema mejorado de optimización de imágenes
 * - Múltiples resoluciones (thumbnail, small, medium, large)
 * - Compresión agresiva usando browser-image-compression
 * - Conversión a WebP
 * - Validación de tamaño y tipo
 */

import imageCompression from 'browser-image-compression';

export interface ImageOptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.0 - 1.0
  format?: 'jpeg' | 'webp' | 'png';
}

export interface ImageVariants {
  thumbnail: Blob; // 200x200
  small: Blob;     // 400x400
  medium: Blob;    // 800x800
  large: Blob;     // 1200x1200
  original?: Blob; // Opcional: mantener original
}

export class ImageOptimizer {
  /**
   * Optimizar imagen con browser-image-compression (mejor que canvas)
   */
  static async optimize(
    file: File,
    options: ImageOptimizationOptions = {}
  ): Promise<Blob> {
    const {
      maxWidth = 1200,
      maxHeight = 1200,
      quality = 0.85,
      format = 'webp'
    } = options;

    try {
      console.log(`📸 [ImageOptimizer] Optimizando imagen...`);
      console.log(`   Original: ${(file.size / 1024 / 1024).toFixed(2)} MB`);

      // Opciones de compresión
      const compressionOptions = {
        maxSizeMB: 1, // Máximo 1MB por imagen
        maxWidthOrHeight: Math.max(maxWidth, maxHeight),
        useWebWorker: true, // Usar Web Worker para no bloquear UI
        fileType: `image/${format}`,
        initialQuality: quality,
      };

      // Comprimir con browser-image-compression
      const compressedBlob = await imageCompression(file, compressionOptions);

      console.log(`   Optimizada: ${(compressedBlob.size / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   Reducción: ${(((file.size - compressedBlob.size) / file.size) * 100).toFixed(1)}%`);

      return compressedBlob;
    } catch (error) {
      console.error('❌ [ImageOptimizer] Error:', error);
      // Fallback: retornar archivo original si falla
      return file;
    }
  }

  /**
   * Crear múltiples versiones optimizadas de una imagen
   */
  static async createVariants(
    file: File,
    options: { includeOriginal?: boolean } = {}
  ): Promise<ImageVariants> {
    console.log(`🎨 [ImageOptimizer] Creando variantes de imagen...`);

    const { includeOriginal = false } = options;

    // Configuraciones para cada variante
    const variants = {
      thumbnail: { maxWidth: 200, maxHeight: 200, quality: 0.8 },
      small: { maxWidth: 400, maxHeight: 400, quality: 0.85 },
      medium: { maxWidth: 800, maxHeight: 800, quality: 0.85 },
      large: { maxWidth: 1200, maxHeight: 1200, quality: 0.9 },
    };

    // Crear todas las variantes en paralelo
    const [thumbnail, small, medium, large] = await Promise.all([
      this.optimize(file, variants.thumbnail),
      this.optimize(file, variants.small),
      this.optimize(file, variants.medium),
      this.optimize(file, variants.large),
    ]);

    const result: ImageVariants = {
      thumbnail,
      small,
      medium,
      large,
    };

    if (includeOriginal) {
      result.original = file;
    }

    console.log(`✅ [ImageOptimizer] Variantes creadas exitosamente`);

    return result;
  }

  /**
   * Optimizar específicamente para productos (banner grande)
   */
  static async optimizeForBanner(file: File): Promise<Blob> {
    return this.optimize(file, {
      maxWidth: 1920,
      maxHeight: 600,
      quality: 0.9,
      format: 'webp',
    });
  }

  /**
   * Optimizar para drops (imagen destacada)
   */
  static async optimizeForDrop(file: File): Promise<Blob> {
    return this.optimize(file, {
      maxWidth: 1200,
      maxHeight: 1200,
      quality: 0.9,
      format: 'webp',
    });
  }

  /**
   * Validar tamaño máximo de archivo
   */
  static validateSize(file: File, maxSizeMB: number = 10): boolean {
    const sizeMB = file.size / 1024 / 1024;
    if (sizeMB > maxSizeMB) {
      console.warn(`⚠️ Archivo muy grande: ${sizeMB.toFixed(2)} MB (máximo: ${maxSizeMB} MB)`);
      return false;
    }
    return true;
  }

  /**
   * Validar tipo de archivo
   */
  static validateType(file: File): boolean {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/avif'];
    if (!allowedTypes.includes(file.type)) {
      console.warn(`⚠️ Tipo de archivo no soportado: ${file.type}`);
      return false;
    }
    return true;
  }

  /**
   * Validar imagen antes de procesar
   */
  static validate(file: File, maxSizeMB: number = 10): { valid: boolean; error?: string } {
    if (!this.validateType(file)) {
      return { valid: false, error: 'Tipo de archivo no soportado. Usa JPG, PNG o WebP.' };
    }

    if (!this.validateSize(file, maxSizeMB)) {
      return { valid: false, error: `El archivo es muy grande. Máximo ${maxSizeMB} MB.` };
    }

    return { valid: true };
  }

  /**
   * Obtener dimensiones de una imagen
   */
  static async getDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: img.width, height: img.height });
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('No se pudo cargar la imagen'));
      };

      img.src = url;
    });
  }

  /**
   * Convertir Blob a File con nombre personalizado
   */
  static blobToFile(blob: Blob, fileName: string, mimeType: string = 'image/webp'): File {
    return new File([blob], fileName, { type: mimeType });
  }

  /**
   * Generar nombre único para imagen
   */
  static generateFileName(prefix: string, extension: string = 'webp'): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `${prefix}_${timestamp}_${random}.${extension}`;
  }
}

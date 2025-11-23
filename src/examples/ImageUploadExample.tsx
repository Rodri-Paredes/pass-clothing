/**
 * Ejemplo completo de subida de imágenes optimizada a Supabase
 * Implementa compresión, múltiples resoluciones y progress tracking
 */

import { useState } from 'react';
import { ImageOptimizer } from '../utils/imageOptimizer.enhanced';
import { supabase } from '../lib/supabase';

interface UploadProgress {
  variant: 'thumbnail' | 'small' | 'medium' | 'large';
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  url?: string;
}

export default function ImageUploadExample() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar
    const validation = ImageOptimizer.validate(file, 10);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    setSelectedFile(file);

    // Crear preview
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  // Upload optimizado con múltiples resoluciones
  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);

    // Inicializar progress
    setUploads([
      { variant: 'thumbnail', progress: 0, status: 'pending' },
      { variant: 'small', progress: 0, status: 'pending' },
      { variant: 'medium', progress: 0, status: 'pending' },
      { variant: 'large', progress: 0, status: 'pending' },
    ]);

    try {
      // 1. Crear variantes optimizadas
      console.log('📸 Creando variantes de imagen...');
      const variants = await ImageOptimizer.createVariants(selectedFile);

      // 2. Generar nombres únicos
      const productId = 'product-' + Date.now(); // Reemplazar con ID real

      // 3. Upload de cada variante en paralelo
      const uploadPromises = Object.entries(variants).map(async ([variantName, blob]) => {
        const variant = variantName as keyof typeof variants;
        
        // Actualizar status a uploading
        setUploads(prev => prev.map(u => 
          u.variant === variant ? { ...u, status: 'uploading' as const } : u
        ));

        // Convertir Blob a File
        const fileName = `${productId}/${variant}.webp`;
        const file = ImageOptimizer.blobToFile(blob, fileName);

        // Upload a Supabase Storage
        const { error } = await supabase.storage
          .from('products')
          .upload(fileName, file, {
            cacheControl: '31536000', // 1 año
            upsert: true,
          });

        if (error) throw error;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('products')
          .getPublicUrl(fileName);

        // Actualizar progress
        setUploads(prev => prev.map(u => 
          u.variant === variant 
            ? { ...u, status: 'success' as const, progress: 100, url: publicUrl }
            : u
        ));

        return { variant, url: publicUrl };
      });

      // Esperar a que todos terminen
      const results = await Promise.all(uploadPromises);

      console.log('✅ Todas las variantes subidas:', results);

      // Aquí guardarías las URLs en la base de datos
      const imageUrls = {
        thumbnail: results.find(r => r.variant === 'thumbnail')?.url,
        small: results.find(r => r.variant === 'small')?.url,
        medium: results.find(r => r.variant === 'medium')?.url,
        large: results.find(r => r.variant === 'large')?.url,
      };

      console.log('📦 URLs para guardar en DB:', imageUrls);

      alert('✅ Imágenes subidas exitosamente!');

    } catch (error) {
      console.error('❌ Error subiendo imágenes:', error);
      alert('Error al subir imágenes. Ver consola.');
      
      // Marcar como error
      setUploads(prev => prev.map(u => 
        u.status === 'uploading' ? { ...u, status: 'error' as const } : u
      ));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">
        📸 Subida Optimizada de Imágenes
      </h2>

      {/* File input */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">
          Seleccionar imagen
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-lg file:border-0
            file:text-sm file:font-semibold
            file:bg-blue-50 file:text-blue-700
            hover:file:bg-blue-100"
          disabled={isUploading}
        />
        <p className="mt-2 text-sm text-gray-500">
          JPG, PNG o WebP. Máximo 10 MB.
        </p>
      </div>

      {/* Preview */}
      {preview && (
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">
            Vista previa
          </label>
          <img
            src={preview}
            alt="Preview"
            className="w-full max-w-md rounded-lg border-2 border-gray-300"
          />
        </div>
      )}

      {/* Upload button */}
      <button
        onClick={handleUpload}
        disabled={!selectedFile || isUploading}
        className="w-full py-3 px-6 bg-blue-600 text-white rounded-lg
          hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed
          transition-colors font-semibold"
      >
        {isUploading ? 'Subiendo...' : 'Subir Imagen'}
      </button>

      {/* Progress */}
      {uploads.length > 0 && (
        <div className="mt-6 space-y-3">
          <h3 className="font-semibold">Progreso de subida:</h3>
          {uploads.map((upload) => (
            <div key={upload.variant} className="border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium capitalize">
                  {upload.variant}
                </span>
                <span className="text-sm">
                  {upload.status === 'pending' && '⏳ Pendiente'}
                  {upload.status === 'uploading' && '📤 Subiendo...'}
                  {upload.status === 'success' && '✅ Completado'}
                  {upload.status === 'error' && '❌ Error'}
                </span>
              </div>
              
              {/* Progress bar */}
              {upload.status !== 'pending' && (
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      upload.status === 'success' ? 'bg-green-500' :
                      upload.status === 'error' ? 'bg-red-500' :
                      'bg-blue-500'
                    }`}
                    style={{ width: `${upload.progress}%` }}
                  />
                </div>
              )}

              {/* URL */}
              {upload.url && (
                <a
                  href={upload.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline block mt-2 truncate"
                >
                  {upload.url}
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

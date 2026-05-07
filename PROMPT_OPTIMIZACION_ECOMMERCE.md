# 🚀 PROMPT: OPTIMIZACIÓN EXTREMA DE SUPABASE CACHED EGRESS PARA ECOMMERCE
## Para copiar y pegar en tu herramienta de desarrollo web

---

## 📋 COPIA DESDE AQUÍ ⬇️

---

```
CONTEXTO:
Tengo un ecommerce de ropa llamado OUTSIDERS conectado a Supabase como backend.
Estoy excediendo constantemente la cuota de "Cached Egress" (transferencia de datos) porque 
la página web hace muchas consultas y carga imágenes constantemente.

OBJETIVO:
Optimizar AL MÁXIMO el consumo de Cached Egress implementando:
1. Caché agresivo en frontend (localStorage + Service Worker)
2. Optimización extrema de imágenes
3. Reducir consultas a Supabase
4. Static Site Generation (SSG) / Incremental Static Regeneration (ISR)
5. Lazy loading y virtualización
6. CDN para assets estáticos

STACK ACTUAL:
- Frontend: Next.js 14+ con App Router
- Backend: Supabase (PostgreSQL + Storage)
- Base de datos:
  * Tabla: products (id, name, price, description, category, image_url, is_visible, drop_id, created_at)
  * Tabla: drops (colecciones de productos)
  * Tabla: product_variants (tallas/variantes)
  * Storage: Bucket "products" con imágenes

IMPLEMENTA ESTAS OPTIMIZACIONES:

---

## 1️⃣ SISTEMA DE CACHÉ MULTI-CAPA

### A. LocalStorage Cache con TTL
Crea un sistema de caché que almacene productos, categorías y datos estáticos:

```typescript
// lib/cache.ts
export class CacheManager {
  private static PREFIX = 'outsiders_';

  static set(key: string, data: any, ttlMinutes: number = 60) {
    const item = {
      data,
      timestamp: Date.now(),
      ttl: ttlMinutes * 60 * 1000
    };
    localStorage.setItem(this.PREFIX + key, JSON.stringify(item));
  }

  static get<T>(key: string): T | null {
    const cached = localStorage.getItem(this.PREFIX + key);
    if (!cached) return null;

    const item = JSON.parse(cached);
    if (Date.now() - item.timestamp > item.ttl) {
      this.clear(key);
      return null;
    }

    return item.data;
  }

  static clear(key: string) {
    localStorage.removeItem(this.PREFIX + key);
  }
}

// Uso en páginas
async function getProducts() {
  const cached = CacheManager.get('products');
  if (cached) return cached;

  const { data } = await supabase.from('products').select('...');
  CacheManager.set('products', data, 60); // 1 hora
  return data;
}
```

### B. Service Worker para caché offline
Implementa un Service Worker que cachee assets y respuestas de API:

```javascript
// public/sw.js
const CACHE_NAME = 'outsiders-v1';
const ASSETS_TO_CACHE = ['/fonts/*', '/icons/*'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
});

self.addEventListener('fetch', (event) => {
  // Cachear imágenes de Supabase Storage
  if (event.request.url.includes('supabase.co/storage')) {
    event.respondWith(
      caches.match(event.request).then(response => {
        return response || fetch(event.request).then(fetchResponse => {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, fetchResponse.clone());
            return fetchResponse;
          });
        });
      })
    );
  }
});
```

---

## 2️⃣ OPTIMIZACIÓN EXTREMA DE IMÁGENES

### A. Componente de Imagen Optimizada
Crea un componente que:
- Use transformaciones de Supabase Storage (resize, webp)
- Implemente lazy loading agresivo
- Tenga placeholder blur mientras carga
- Comprima automáticamente al subir

```tsx
// components/OptimizedImage.tsx
import Image from 'next/image';

export function OptimizedImage({ src, alt, width = 400, quality = 75 }) {
  // Transformar URL de Supabase Storage
  const optimizedSrc = src?.includes('supabase.co/storage')
    ? `${src}?width=${width}&quality=${quality}&format=webp`
    : src;

  return (
    <Image
      src={optimizedSrc || '/placeholder.jpg'}
      alt={alt}
      width={width}
      height={width}
      loading="lazy"
      placeholder="blur"
      blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRg..." // Placeholder blur base64
      className="object-cover"
    />
  );
}
```

### B. Compresión automática al subir imágenes
Cuando suban productos desde el admin, comprimir antes de subir:

```typescript
import imageCompression from 'browser-image-compression';

async function uploadProductImage(file: File) {
  // Comprimir a máximo 200KB y 1200px
  const compressed = await imageCompression(file, {
    maxSizeMB: 0.2,
    maxWidthOrHeight: 1200,
    useWebWorker: true,
    fileType: 'image/webp'
  });

  const { data, error } = await supabase.storage
    .from('products')
    .upload(`${Date.now()}.webp`, compressed);

  return data?.path;
}
```

**INSTALAR:** `npm install browser-image-compression`

---

## 3️⃣ STATIC SITE GENERATION (SSG) + ISR

### A. Generar páginas estáticas para productos
Usa SSG para pre-renderizar productos y solo revalidar cada X tiempo:

```tsx
// app/shop/[slug]/page.tsx
export const revalidate = 3600; // Revalidar cada 1 hora

export async function generateStaticParams() {
  const { data: products } = await supabase
    .from('products')
    .select('id')
    .eq('is_visible', true);

  return products?.map(p => ({ slug: p.id })) || [];
}

export default async function ProductPage({ params }) {
  // Esto se ejecuta en el SERVIDOR, no consume egress del cliente
  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('id', params.slug)
    .single();

  return <ProductDetail product={product} />;
}
```

### B. Catálogo con ISR
```tsx
// app/shop/page.tsx
export const revalidate = 600; // Revalidar cada 10 minutos

export default async function ShopPage() {
  const { data: products } = await supabase
    .from('products')
    .select('id, name, price, image_url, category')
    .eq('is_visible', true)
    .order('created_at', { ascending: false });

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {products?.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
```

---

## 4️⃣ REDUCIR CONSULTAS A SUPABASE

### A. Solo campos necesarios (NO usar SELECT *)
```typescript
// ❌ MAL - Trae TODO
const { data } = await supabase.from('products').select('*');

// ✅ BIEN - Solo lo necesario
const { data } = await supabase
  .from('products')
  .select('id, name, price, image_url, category')
  .eq('is_visible', true);
```

### B. Implementar React Query con caché agresivo
```typescript
// hooks/useProducts.ts
import { useQuery } from '@tanstack/react-query';

export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data } = await supabase
        .from('products')
        .select('id, name, price, image_url, category')
        .eq('is_visible', true);
      return data;
    },
    staleTime: 10 * 60 * 1000,  // 10 minutos stale
    cacheTime: 30 * 60 * 1000,  // 30 minutos en memoria
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}
```

**INSTALAR:** `npm install @tanstack/react-query`

### C. Prefetch para navegación anticipada
```tsx
// components/ProductCard.tsx
import { useQueryClient } from '@tanstack/react-query';

export function ProductCard({ product }) {
  const queryClient = useQueryClient();

  const prefetchProduct = () => {
    queryClient.prefetchQuery({
      queryKey: ['product', product.id],
      queryFn: () => fetchProductDetail(product.id),
      staleTime: 10 * 60 * 1000,
    });
  };

  return (
    <Link 
      href={`/product/${product.id}`}
      onMouseEnter={prefetchProduct} // Precargar en hover
    >
      <OptimizedImage src={product.image_url} alt={product.name} />
    </Link>
  );
}
```

---

## 5️⃣ LAZY LOADING Y VIRTUALIZACIÓN

### A. Infinite Scroll con Virtual Scroll
Para listas largas de productos, usa virtualización:

```tsx
import { Virtuoso } from 'react-virtuoso';

export function ProductGrid({ products }) {
  return (
    <Virtuoso
      data={products}
      itemContent={(index, product) => (
        <ProductCard product={product} />
      )}
      style={{ height: '100vh' }}
    />
  );
}
```

**INSTALAR:** `npm install react-virtuoso`

### B. Intersection Observer para lazy load manual
```tsx
import { useInView } from 'react-intersection-observer';

export function LazyProductCard({ product }) {
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  return (
    <div ref={ref}>
      {inView ? (
        <ProductCard product={product} />
      ) : (
        <div className="h-64 bg-gray-200 animate-pulse" />
      )}
    </div>
  );
}
```

**INSTALAR:** `npm install react-intersection-observer`

---

## 6️⃣ CDN EXTERNA PARA IMÁGENES (CRÍTICO)

### Opción A: Cloudinary (Recomendado)
Migra las imágenes a Cloudinary para NO consumir egress de Supabase:

```typescript
// lib/cloudinary.ts
const CLOUD_NAME = 'tu-cloud-name';

export function getCloudinaryUrl(publicId: string, width: number = 400) {
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/w_${width},q_auto,f_auto,c_fill/${publicId}`;
}

// Uso
<img src={getCloudinaryUrl('productos/camiseta-1', 400)} />
```

**SETUP:**
1. Crear cuenta en Cloudinary (25GB gratis/mes)
2. Subir imágenes existentes
3. Actualizar URLs en la base de datos

### Opción B: Cloudflare (Proxy + Cache)
Si no puedes migrar imágenes, usa Cloudflare como proxy:

1. Añade tu dominio a Cloudflare
2. Activa "Cache Everything" para imágenes
3. Las imágenes se cachearán en CDN de Cloudflare, no consumirán egress de Supabase

---

## 7️⃣ CONFIGURACIÓN DE NEXT.JS PARA MÁXIMO RENDIMIENTO

```javascript
// next.config.js
module.exports = {
  images: {
    domains: ['supabase.co', 'res.cloudinary.com'],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 3600, // Cachear imágenes 1 hora
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  
  // Habilitar compresión
  compress: true,
  
  // Output standalone para Vercel
  output: 'standalone',
  
  // Headers de caché
  async headers() {
    return [
      {
        source: '/:all*(svg|jpg|jpeg|png|webp|gif|avif)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }
        ],
      },
    ];
  },
};
```

---

## 8️⃣ PAGINACIÓN EFICIENTE

```tsx
// app/shop/page.tsx con paginación
export default function ShopPage({ searchParams }) {
  const page = Number(searchParams.page) || 1;
  const LIMIT = 20;
  const from = (page - 1) * LIMIT;
  const to = from + LIMIT - 1;

  const { data: products } = await supabase
    .from('products')
    .select('id, name, price, image_url, category')
    .eq('is_visible', true)
    .range(from, to);

  return (
    <>
      <ProductGrid products={products} />
      <Pagination currentPage={page} />
    </>
  );
}
```

---

## 9️⃣ ANALYTICS Y MONITOREO

### Agregar logging para medir consumo:
```typescript
// lib/analytics.ts
export function logDataTransfer(endpoint: string, size: number) {
  const sizeKB = (size / 1024).toFixed(2);
  console.log(`📊 ${endpoint}: ${sizeKB}KB`);
  
  // Enviar a analytics (opcional)
  if (typeof window !== 'undefined') {
    window.dataLayer?.push({
      event: 'data_transfer',
      endpoint,
      size: sizeKB,
    });
  }
}

// Uso
const { data } = await supabase.from('products').select('...');
if (data) {
  const size = new Blob([JSON.stringify(data)]).size;
  logDataTransfer('products', size);
}
```

---

## 🔟 CHECKLIST DE IMPLEMENTACIÓN

Implementa EN ESTE ORDEN:

1. [ ] **CDN para imágenes** (Cloudinary o Cloudflare) ← CRÍTICO
2. [ ] **Componente OptimizedImage** con lazy loading
3. [ ] **CacheManager** con localStorage
4. [ ] **React Query** con caché agresivo
5. [ ] **SSG/ISR** para páginas de productos
6. [ ] **Queries optimizadas** (solo campos necesarios)
7. [ ] **Service Worker** para caché offline
8. [ ] **Virtual scroll** para listas largas
9. [ ] **Paginación** en lugar de cargar todo
10. [ ] **Compresión de imágenes** al subir

---

## 📊 RESULTADO ESPERADO

### Antes:
- 🔴 Imágenes sin comprimir: 2-5MB por imagen
- 🔴 SELECT * trae todos los campos: 500KB por query
- 🔴 Sin caché: cada visita = nuevas queries
- 🔴 5GB egress/mes → EXCEDIDO

### Después:
- 🟢 Imágenes WebP optimizadas: 50-200KB (reducción ~90%)
- 🟢 Queries específicas: 50-100KB (reducción ~80%)
- 🟢 Caché agresivo: 90% de visits sin queries
- 🟢 Imágenes en CDN: 0 egress de Supabase
- 🟢 **Consumo total: <1GB/mes** ✅

---

## 🚨 PRIORIDAD CRÍTICA

Si solo puedes hacer UNA cosa ahora mismo:
👉 **Migra las imágenes a Cloudinary** 

Las imágenes representan el 80-90% del egress. Al moverlas fuera de Supabase Storage, 
resolverás el problema inmediatamente.

---

## 📦 DEPENDENCIAS A INSTALAR

```bash
npm install @tanstack/react-query browser-image-compression react-virtuoso react-intersection-observer
```

---

## 💡 CONFIGURACIÓN ADICIONAL EN SUPABASE

En tu proyecto de Supabase:
1. Ve a Settings → API
2. Activa "Enable realtime" solo si lo necesitas (consume ancho de banda)
3. En Storage → Settings, configura "Cache-Control: public, max-age=31536000"

---

IMPLEMENTA TODAS ESTAS OPTIMIZACIONES y tu consumo de Cached Egress bajará a menos del 20% 
del actual. El foco principal es IMÁGENES en CDN + CACHÉ AGRESIVO + SSG/ISR.

¿Alguna duda sobre la implementación?
```

---

## ✅ FIN DEL PROMPT - COPIA HASTA AQUÍ ⬆️

---

## 📌 INSTRUCCIONES DE USO:

1. **Copia todo el contenido** desde "CONTEXTO:" hasta el final
2. **Pégalo** en tu herramienta de desarrollo (Bolt, Cursor, v0, etc.)
3. **Modifica** los detalles específicos de tu proyecto si es necesario
4. **Implementa** siguiendo el orden del checklist

---

## 🎯 RESUMEN EJECUTIVO:

**Problema:** Cached Egress se llena por imágenes pesadas y muchas consultas

**Solución:**
1. 🖼️ **CDN para imágenes** (Cloudinary) → 80% reducción
2. 💾 **Caché agresivo** (localStorage + Service Worker) → 70% menos queries
3. 🏗️ **SSG/ISR** → Renderizado en servidor, 0 egress cliente
4. 📊 **Queries optimizadas** → Solo campos necesarios

**Resultado:** De 5GB/mes a <1GB/mes (reducción de ~80%)

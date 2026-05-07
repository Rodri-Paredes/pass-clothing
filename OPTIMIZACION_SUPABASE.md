# 🚀 GUÍA DE OPTIMIZACIÓN SUPABASE
## Reducir Consumo de Cached Egress

---

## 📊 PROBLEMA ACTUAL

Has excedido la cuota de **Cached Egress** (transferencia de datos en caché) del plan gratuito de Supabase.

**Plan Gratuito incluye:**
- ✅ 5 GB de Egress (transferencia fuera de Supabase)
- ❌ Cuando se excede → Servicio restringido (error 402)

**Causas comunes:**
1. Imágenes grandes sin optimizar
2. Consultas con `SELECT *` que traen datos innecesarios
3. Falta de caché en el frontend
4. Llamadas redundantes a la base de datos
5. Cargar productos completos en listas (deberías paginar)

---

## 🎯 ESTRATEGIA DE OPTIMIZACIÓN

### **PRIORIDAD ALTA** ⚡
Estas optimizaciones reducirán el 70-80% del consumo:

#### 1. **OPTIMIZAR CONSULTAS SQL** (Impacto: 40%)
#### 2. **IMPLEMENTAR CACHÉ FRONTEND** (Impacto: 30%)
#### 3. **OPTIMIZAR IMÁGENES** (Impacto: 20-30%)

### **PRIORIDAD MEDIA** 🔶
Optimizaciones adicionales:

#### 4. **MEJORAR PAGINACIÓN**
#### 5. **COMPRIMIR RESPUESTAS**

---

## 🛠️ IMPLEMENTACIÓN DETALLADA

---

## 1️⃣ OPTIMIZAR CONSULTAS SQL (ERP)

### ❌ **PROBLEMA ACTUAL**

Tu código actual usa `SELECT *` que trae TODOS los campos:

```typescript
// ❌ MAL - Trae todos los campos innecesariamente
async getAllDiscounts(): Promise<Discount[]> {
  const { data, error } = await supabase
    .from('discounts')
    .select('*')  // ← PROBLEMA: trae imagen_url, descriptions largas, etc.
    .order('created_at', { ascending: false });

  // ❌ MUY MAL - N+1 queries (una por cada descuento)
  const discountsWithCount = await Promise.all(
    data.map(async (discount) => {
      const [{ count: productCount }, { count: dropCount }] = await Promise.all([
        supabase.from('discount_products').select('*', { count: 'exact', head: true })
        // Hace 2 consultas adicionales por CADA descuento
      ]);
    })
  );
}

// ❌ MAL - Trae productos completos con variantes
async getProducts(): Promise<Product[]> {
  return supabase
    .from('products')
    .select(`
      *,
      variants:product_variants(*)  // ← Trae TODAS las variantes
    `)
}
```

### ✅ **SOLUCIÓN: Seleccionar solo campos necesarios**

```typescript
// ✅ BIEN - Solo campos necesarios para la lista
async getAllDiscounts(): Promise<Discount[]> {
  const { data, error } = await supabase
    .from('discounts')
    .select(`
      id,
      name,
      type,
      value,
      status,
      start_date,
      end_date,
      discount_products(count),
      discount_drops(count)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  
  return data?.map(d => ({
    ...d,
    product_count: d.discount_products[0]?.count || 0,
    drop_count: d.discount_drops[0]?.count || 0
  })) || [];
}

// ✅ BIEN - Solo campos esenciales para lista
async getProductsForList(): Promise<Product[]> {
  return supabase
    .from('products')
    .select(`
      id,
      name,
      price,
      category,
      is_visible,
      image_url
    `)
    .eq('is_visible', true)
    .order('created_at', { ascending: false });
}

// ✅ BIEN - Detalles completos solo cuando se necesitan
async getProductDetails(id: string): Promise<Product | null> {
  return supabase
    .from('products')
    .select(`
      *,
      variants:product_variants(
        id,
        size,
        stock:stock(quantity, branch_id)
      )
    `)
    .eq('id', id)
    .single();
}
```

---

## 2️⃣ IMPLEMENTAR CACHÉ EN FRONTEND

### ✅ **OPCIÓN A: React Query (Recomendado)**

Ya tienes `queryClient.ts` configurado, úsalo más:

```typescript
// src/hooks/useProducts.ts
import { useQuery } from '@tanstack/react-query';
import { productService } from '../services/productService';

export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: () => productService.getProducts(),
    staleTime: 5 * 60 * 1000,  // ✅ Caché por 5 minutos
    cacheTime: 10 * 60 * 1000, // ✅ Mantener en memoria 10 min
    refetchOnWindowFocus: false, // ✅ No recargar al cambiar de tab
  });
}

// Para lista paginada con caché
export function useProductsPaginated(page: number) {
  return useQuery({
    queryKey: ['products', 'paginated', page],
    queryFn: () => productService.getProductsPaginated({ page, limit: 20 }),
    staleTime: 5 * 60 * 1000,
    keepPreviousData: true, // ✅ Mantiene página anterior mientras carga
  });
}

// Para descuentos
export function useDiscounts() {
  return useQuery({
    queryKey: ['discounts'],
    queryFn: () => discountService.getAllDiscounts(),
    staleTime: 10 * 60 * 1000, // ✅ Los descuentos cambian poco
  });
}
```

### ✅ **OPCIÓN B: LocalStorage (Simple pero efectiva)**

```typescript
// src/utils/cacheManager.ts
export class CacheManager {
  private static getCacheKey(key: string): string {
    return `cache_${key}`;
  }

  // Guardar en caché con TTL
  static set(key: string, data: any, ttlMinutes: number = 5): void {
    const item = {
      data,
      timestamp: Date.now(),
      ttl: ttlMinutes * 60 * 1000
    };
    localStorage.setItem(this.getCacheKey(key), JSON.stringify(item));
  }

  // Obtener desde caché (null si expiró)
  static get<T>(key: string): T | null {
    const cached = localStorage.getItem(this.getCacheKey(key));
    if (!cached) return null;

    const item = JSON.parse(cached);
    const isExpired = Date.now() - item.timestamp > item.ttl;
    
    if (isExpired) {
      this.clear(key);
      return null;
    }

    return item.data;
  }

  static clear(key: string): void {
    localStorage.removeItem(this.getCacheKey(key));
  }

  static clearAll(): void {
    Object.keys(localStorage)
      .filter(k => k.startsWith('cache_'))
      .forEach(k => localStorage.removeItem(k));
  }
}

// Usar en tus servicios
export class ProductService {
  async getProducts(includeHidden: boolean = false): Promise<Product[]> {
    const cacheKey = `products_${includeHidden}`;
    
    // 1. Intentar obtener desde caché
    const cached = CacheManager.get<Product[]>(cacheKey);
    if (cached) {
      console.log('📦 Productos desde caché');
      return cached;
    }

    // 2. Si no hay caché, consultar DB
    console.log('🌐 Consultando productos desde Supabase');
    const { data, error } = await supabase
      .from('products')
      .select('id, name, price, category, is_visible, image_url')
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    // 3. Guardar en caché por 5 minutos
    CacheManager.set(cacheKey, data || [], 5);
    
    return data || [];
  }
}
```

---

## 3️⃣ OPTIMIZAR IMÁGENES

### ❌ **PROBLEMA: Imágenes sin optimizar**

Las imágenes son el **mayor consumidor** de egress:
- Una imagen de 2MB × 100 usuarios = 200MB transferidos
- Si tienes 50 productos con imágenes grandes = 💥 Boom!

### ✅ **SOLUCIÓN 1: Comprimir antes de subir**

Usa herramientas antes de subir a Supabase:

#### **A. Compresión manual:**
- **TinyPNG**: https://tinypng.com/
- **Squoosh**: https://squoosh.app/
- **ImageOptim** (Mac)

**Tamaños recomendados:**
- Thumbnail lista: 400x400px, calidad 80%, ~50-80KB
- Detalle producto: 1200x1200px, calidad 85%, ~150-250KB
- Hero/Banner: 1920x800px, calidad 85%, ~200-350KB

#### **B. Compresión automática (código):**

```typescript
// src/utils/imageCompressor.ts
import imageCompression from 'browser-image-compression';

export async function compressImage(file: File): Promise<File> {
  const options = {
    maxSizeMB: 0.5,          // ✅ Máximo 500KB
    maxWidthOrHeight: 1200,   // ✅ Redimensionar a 1200px
    useWebWorker: true,
    fileType: 'image/webp'    // ✅ WebP es más eficiente que JPEG
  };

  try {
    const compressed = await imageCompression(file, options);
    console.log(`Comprimido: ${file.size / 1024}KB → ${compressed.size / 1024}KB`);
    return compressed;
  } catch (error) {
    console.error('Error comprimiendo imagen:', error);
    return file;
  }
}

// Usar al subir producto
async function handleImageUpload(file: File) {
  const compressed = await compressImage(file);
  // Luego subir a Supabase Storage
  const { data, error } = await supabase.storage
    .from('products')
    .upload(`${Date.now()}_${compressed.name}`, compressed);
}
```

**Instalar:**
```bash
npm install browser-image-compression
```

### ✅ **SOLUCIÓN 2: Usar Supabase Image Transformation**

Supabase puede transformar imágenes on-the-fly:

```typescript
// ❌ MAL - Siempre carga imagen completa
<img src={product.image_url} />

// ✅ BIEN - Redimensiona automáticamente
function getOptimizedImageUrl(url: string, width: number = 400): string {
  if (!url) return '';
  
  // Si es URL de Supabase Storage
  if (url.includes('supabase.co/storage')) {
    return `${url}?width=${width}&quality=80`;
  }
  
  return url;
}

// Usar en componentes
<img 
  src={getOptimizedImageUrl(product.image_url, 400)} 
  alt={product.name}
  loading="lazy"  // ✅ Lazy loading nativo
/>
```

### ✅ **SOLUCIÓN 3: WebP + Fallback**

```tsx
// Componente de imagen optimizado
type OptimizedImageProps = {
  src: string;
  alt: string;
  width?: number;
  className?: string;
};

export function OptimizedImage({ src, alt, width = 400, className }: OptimizedImageProps) {
  const webpUrl = getOptimizedImageUrl(src, width);
  const fallbackUrl = src;

  return (
    <picture>
      <source type="image/webp" srcSet={webpUrl} />
      <img 
        src={fallbackUrl} 
        alt={alt} 
        loading="lazy"
        className={className}
      />
    </picture>
  );
}
```

### ✅ **SOLUCIÓN 4: CDN Externo (Cloudinary/ImgIX)**

Si puedes invertir un poco más, usa un CDN especializado:

**Cloudinary (Free: 25GB/mes)**

```typescript
// src/lib/cloudinary.ts
const CLOUD_NAME = 'tu-cloud-name';

export function getCloudinaryUrl(publicId: string, width: number = 400): string {
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/w_${width},q_auto,f_auto/${publicId}`;
}

// Uso
<img src={getCloudinaryUrl('productos/camiseta-1', 400)} />
```

**Ventajas:**
- No consume tu egress de Supabase
- Transformaciones automáticas (resize, webp, etc.)
- CDN global (carga más rápido)

---

## 4️⃣ MEJORAR PAGINACIÓN

Ya tienes `getProductsPaginated`, pero asegúrate de usarlo siempre:

```typescript
// ✅ BIEN - Componente de lista paginada
export function ProductsList() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['products', page],
    queryFn: () => productService.getProductsPaginated({
      page,
      limit: 20,  // ✅ Solo 20 productos por request
    }),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <>
      {data?.items.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
      
      {data?.hasMore && (
        <button onClick={() => setPage(p => p + 1)}>
          Cargar más
        </button>
      )}
    </>
  );
}
```

---

## 5️⃣ COMPRIMIR RESPUESTAS API

Si creas endpoints personalizados (Edge Functions), activa compresión:

```typescript
// supabase/functions/products/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req) => {
  const data = await getProducts();
  
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Encoding': 'gzip', // ✅ Compresión
    },
  });
});
```

---

## 📱 OPTIMIZACIONES PARA ECOMMERCE

Si tienes/planeas un ecommerce público, estas optimizaciones son **CRÍTICAS**:

### 🎯 **1. Server-Side Rendering (Next.js)**

```typescript
// app/shop/page.tsx (Next.js 14+)
export default async function ShopPage() {
  // ✅ Se ejecuta en el servidor, no consume egress del cliente
  const products = await getProducts();
  
  return (
    <div>
      {products.map(p => <ProductCard key={p.id} product={p} />)}
    </div>
  );
}

// Revalidar cada 5 minutos
export const revalidate = 300;
```

### 🎯 **2. Static Generation para productos**

```typescript
// app/shop/[slug]/page.tsx
export async function generateStaticParams() {
  const products = await getProducts();
  return products.map(p => ({ slug: p.id }));
}

// Página estática por producto ✅
export default async function ProductPage({ params }) {
  const product = await getProduct(params.slug);
  return <ProductDetail product={product} />;
}
```

### 🎯 **3. CDN para Assets Estáticos**

**Vercel (si usas Next.js):**
- Automáticamente cachea assets estáticos
- Costo: $0 para 100GB/mes

**Cloudflare:**
- Pones tu dominio detrás de Cloudflare
- Cachea todo automáticamente
- Costo: $0 (plan gratuito)

### 🎯 **4. Infinite Scroll con Virtual Scroll**

Para listas largas de productos:

```bash
npm install react-virtuoso
```

```tsx
import { Virtuoso } from 'react-virtuoso';

export function VirtualProductList() {
  const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
    queryKey: ['products'],
    queryFn: ({ pageParam = 1 }) => 
      productService.getProductsPaginated({ page: pageParam, limit: 20 }),
    getNextPageParam: (lastPage, pages) => 
      lastPage.hasMore ? pages.length + 1 : undefined,
  });

  const allProducts = data?.pages.flatMap(page => page.items) || [];

  return (
    <Virtuoso
      data={allProducts}
      endReached={() => hasNextPage && fetchNextPage()}
      itemContent={(index, product) => (
        <ProductCard key={product.id} product={product} />
      )}
    />
  );
}
```

---

## 📊 MONITOREO Y MÉTRICAS

### 1️⃣ **Dashboard de Supabase**

Ve a: `Project Settings → Billing → Usage`

Revisa:
- 📈 Egress diario/mensual
- 🔍 Queries más pesadas (en Reports)
- 📅 Cuándo se reinicia la cuota

### 2️⃣ **Logging en el código**

```typescript
// src/utils/logger.ts
export class ApiLogger {
  static logQuery(endpoint: string, dataSize: number) {
    console.log(`📊 Query: ${endpoint} | Size: ${(dataSize / 1024).toFixed(2)}KB`);
  }
}

// Usar en servicios
async getProducts() {
  const { data, error } = await supabase.from('products').select('*');
  
  if (data) {
    const size = new Blob([JSON.stringify(data)]).size;
    ApiLogger.logQuery('products', size);
  }
  
  return data;
}
```

### 3️⃣ **Bundle Analyzer (para frontend)**

```bash
npm install -D @next/bundle-analyzer  # Next.js
# o
npm install -D vite-bundle-visualizer  # Vite
```

Identifica librerías pesadas que se cargan innecesariamente.

---

## 🎯 PLAN DE ACCIÓN INMEDIATO

### **HOY** (Reducción ~50%)

1. ✅ **Optimizar `discountService.ts`** - Reemplazar `select('*')` por campos específicos
2. ✅ **Optimizar `productService.ts`** - Separar `getProducts()` y `getProductDetails()`
3. ✅ **Activar caché en hooks existentes** - Configurar `staleTime` en React Query

### **ESTA SEMANA** (Reducción adicional ~30%)

4. ✅ **Comprimir todas las imágenes actuales** - Usar TinyPNG
5. ✅ **Implementar lazy loading** - Añadir `loading="lazy"` a todas las imágenes
6. ✅ **Revisar otros servicios** - Aplicar mismo patrón a `salesService`, `dropsService`, etc.

### **PRÓXIMAMENTE** (Reducción final ~20%)

7. ✅ **CDN o Cloudinary** - Para imágenes (libera egress casi completamente)
8. ✅ **Edge Functions** - Para lógica compleja con caché
9. ✅ **Upgrade a Pro** - Si el negocio lo justifica ($25/mes)

---

## 💰 COMPARACIÓN DE PLANES

| Plan | Precio | Egress Incluido | Almacenamiento |
|------|--------|----------------|----------------|
| **Free** | $0 | 5 GB/mes | 500 MB |
| **Pro** | $25/mes | 250 GB/mes | 100 GB |
| **Team** | $599/mes | 1000 GB/mes | 200 GB |

**Tip:** Con las optimizaciones de esta guía, podrías mantenerte en el plan Free o usar el Pro con holgura.

---

## 🔧 ARCHIVOS A MODIFICAR

### Alta prioridad:
- ✅ `src/services/productService.ts`
- ✅ `src/services/discountService.ts`
- ✅ `src/services/salesService.ts`
- ✅ `src/hooks/useProducts.ts`

### Media prioridad:
- ✅ `src/services/dropsService.ts`
- ✅ `src/components/products/*` (añadir lazy loading)
- ✅ Crear `src/utils/cacheManager.ts`
- ✅ Crear `src/utils/imageOptimizer.ts`

---

## ❓ FAQ

**P: ¿Cuánto puedo reducir el consumo?**  
R: Con estas optimizaciones: 60-80% menos egress.

**P: ¿Necesito actualizar a Pro?**  
R: Depende de tu tráfico. Si tienes >100 usuarios activos diarios, sí considera Pro.

**P: ¿Las optimizaciones afectan la experiencia de usuario?**  
R: Al contrario, mejoran la velocidad de carga. El caché hace que todo sea más rápido.

**P: ¿Qué hago con las imágenes actuales en Supabase Storage?**  
R: Puedes descargarlas, comprimirlas y volver a subirlas. O usar transformación on-the-fly.

**P: ¿Cómo sé qué consulta consume más?**  
R: Ve a tu dashboard Supabase → Reports → API → Most used endpoints

---

## 📚 RECURSOS ADICIONALES

- [Supabase Performance](https://supabase.com/docs/guides/database/performance)
- [React Query Caching](https://tanstack.com/query/latest/docs/react/guides/caching)
- [Image Optimization Best Practices](https://web.dev/fast/#optimize-your-images)
- [Cloudinary Docs](https://cloudinary.com/documentation)

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

```
ERP:
[ ] Optimizar queries en productService
[ ] Optimizar queries en discountService
[ ] Optimizar queries en salesService
[ ] Configurar staleTime en React Query
[ ] Implementar CacheManager
[ ] Comprimir imágenes existentes
[ ] Añadir lazy loading a imágenes
[ ] Crear componente OptimizedImage
[ ] Instalar browser-image-compression
[ ] Habilitar transformación de imágenes Supabase

ECOMMERCE (si aplica):
[ ] Configurar Next.js con SSR/SSG
[ ] Implementar ISR (Incremental Static Regeneration)
[ ] CDN para assets estáticos
[ ] Cloudinary para imágenes de productos
[ ] Virtual scroll para listas largas
[ ] Service Worker para caché offline
[ ] Comprimir responses con gzip
```

---

**¿Necesitas ayuda implementando algo específico? Dame un 👍 y te ayudo con el código!**

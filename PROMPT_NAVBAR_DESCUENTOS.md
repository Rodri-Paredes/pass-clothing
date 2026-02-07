# 🔥 FUNCIONALIDAD: Navbar con Sección de Descuentos "PASS OFF"

## 📋 Objetivo

Agregar una sección especial en el navbar del ERP que muestre productos con descuento activo, estilo "PASS OFF" o "SALE", para que los vendedores puedan acceder rápidamente a productos en oferta.

---

## 🗄️ TABLAS EXISTENTES EN LA BASE DE DATOS

**IMPORTANTE**: Estas tablas YA ESTÁN CREADAS en Supabase. NO necesitas crearlas, solo usarlas.

### Sistema de Productos (Ya existe)
```sql
-- Tabla de productos
CREATE TABLE products (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  image_url TEXT,
  visible BOOLEAN DEFAULT true,
  drop_id UUID REFERENCES drops(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de variantes de productos (tallas/colores)
CREATE TABLE product_variants (
  id UUID PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  size TEXT NOT NULL,
  color TEXT,
  sku TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Sistema de Descuentos (Ya existe - Creado anteriormente)
```sql
-- Tabla de descuentos
CREATE TABLE discounts (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  percentage DECIMAL(5,2) NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de productos con descuento (relación muchos a muchos)
CREATE TABLE discount_products (
  id UUID PRIMARY KEY,
  discount_id UUID REFERENCES discounts(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(discount_id, product_id)
);

-- Tabla de drops con descuento
CREATE TABLE discount_drops (
  id UUID PRIMARY KEY,
  discount_id UUID REFERENCES discounts(id) ON DELETE CASCADE,
  drop_id UUID REFERENCES drops(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(discount_id, drop_id)
);

-- Vista para productos con descuento activo
CREATE VIEW products_with_active_discount AS
SELECT DISTINCT
  p.*,
  d.id as discount_id,
  d.name as discount_name,
  d.percentage as discount_percentage
FROM products p
LEFT JOIN discount_products dp ON p.id = dp.product_id
LEFT JOIN discounts d ON dp.discount_id = d.id
WHERE d.is_active = true
  AND d.start_date <= NOW()
  AND d.end_date >= NOW();
```

### Sistema de Drops/Colecciones (Ya existe)
```sql
-- Tabla de drops
CREATE TABLE drops (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  launch_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  status TEXT DEFAULT 'ACTIVO',
  is_featured BOOLEAN DEFAULT false,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de productos en drops
CREATE TABLE drop_products (
  id UUID PRIMARY KEY,
  drop_id UUID REFERENCES drops(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  is_featured BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(drop_id, product_id)
);
```

### Cómo Funciona el Sistema de Descuentos

1. **Descuentos Directos por Producto**:
   - Se crea un descuento en la tabla `discounts`
   - Se asocian productos en `discount_products`
   - Los productos tienen descuento individual

2. **Descuentos por Drop (Colección)**:
   - Se crea un descuento en la tabla `discounts`
   - Se asocian drops enteros en `discount_drops`
   - TODOS los productos de ese drop obtienen el descuento

3. **Prioridad**: 
   - Si un producto tiene descuento directo Y está en un drop con descuento
   - Se usa el descuento directo (mayor prioridad)

4. **Estado del Store**:
   - El `discountStore` (Zustand) carga los descuentos activos
   - Mantiene un `activeDiscountsMap: Map<productId, discountInfo>`
   - Este Map ya incluye productos con descuento directo Y por drop

---

## 🎯 Funcionalidad Requerida

### Navbar Principal
- Agregar nuevo ítem: **"PASS OFF 🔥"** o **"OFERTAS ⚡"**
- Posición: Entre "Ventas" y "Productos" en la sidebar
- Color distintivo: Rojo/Naranja para llamar la atención
- Badge contador: Mostrar número de productos con descuento

### Mega Menú/Dropdown al Hover
Cuando el usuario pasa el mouse sobre "PASS OFF":
- **Dropdown animado** que muestra productos con descuento
- Grid de productos compacto
- Vista previa rápida de ofertas

### Página Dedicada `/pass-off`
Página completa mostrando todos los productos con descuento activo.

---

## 📦 STORES EXISTENTES (Zustand)

### discountStore (Ya existe)
```typescript
// src/store/discountStore.ts
interface DiscountStore {
  discounts: Discount[];
  activeDiscountsMap: Map<string, {
    percentage: number;
    name: string;
    source: 'product' | 'drop';
  }>;
  isLoading: boolean;
  error: string | null;
  
  loadActiveDiscountsMap: () => Promise<void>;
  // ... más métodos
}
```

**activeDiscountsMap Explicado**:
- Es un Map con key = productId, value = info del descuento
- Se carga automáticamente con `loadActiveDiscountsMap()`
- Ya incluye productos con descuento directo Y productos en drops con descuento
- Actualizado en tiempo real cuando cambian los descuentos

### productStore (Ya existe)
```typescript
// src/store/productStore.ts
interface ProductStore {
  products: Product[];
  isLoading: boolean;
  loadProducts: (forceRefresh?: boolean) => Promise<void>;
  // ... más métodos
}
```

---

## 🔌 COMPONENTES EXISTENTES QUE PUEDES REUTILIZAR

### DiscountBadge (Ya existe)
```typescript
// src/components/discounts/DiscountBadge.tsx
<DiscountBadge percentage={20} />
// Muestra: badge rojo con "-20%"
```

### DiscountPrice (Ya existe)
```typescript
// src/components/discounts/DiscountBadge.tsx
<DiscountPrice 
  originalPrice={100} 
  discountedPrice={80} 
/>
// Muestra: $100 tachado + $80 en verde
```

---

## ✅ LO QUE YA TIENES (NO CREES DE NUEVO)

1. ✅ Tablas de base de datos (products, discounts, discount_products, discount_drops)
2. ✅ Sistema de descuentos funcionando
3. ✅ discountStore con activeDiscountsMap
4. ✅ productStore con productos
5. ✅ Componentes DiscountBadge y DiscountPrice
6. ✅ Los descuentos ya se aplican automáticamente en ventas

---

## ⚠️ LO QUE NECESITAS CREAR (NUEVO)

1. ❌ Hook `useDiscountedProducts` (nuevo)
2. ❌ Componente `DiscountDropdown` (nuevo, opcional)
3. ❌ Página `PassOffPage` (nueva)
4. ❌ Link en Sidebar apuntando a `/pass-off`
5. ❌ Ruta `/pass-off` en App.tsx

---

## 🏗️ Estructura de Componentes

```
src/
├── components/
│   ├── layout/
│   │   └── Sidebar.tsx              # Agregar link PASS OFF
│   └── discounts/
│       ├── DiscountDropdown.tsx     # Dropdown en navbar
│       └── DiscountedProductCard.tsx # Card compacto
├── pages/
│   └── PassOffPage.tsx              # Página completa de ofertas
└── hooks/
    └── useDiscountedProducts.ts     # Hook para productos con descuento
```

---

## 💻 Implementación

### 1. Agregar Link en Sidebar

**Archivo**: `src/components/layout/Sidebar.tsx`

```typescript
// Agregar después del link de Ventas
<Link
  to="/pass-off"
  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
    location.pathname === '/pass-off'
      ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg'
      : 'text-gray-700 hover:bg-red-50 hover:text-red-600'
  }`}
>
  <Percent className="h-5 w-5" />
  <span className="font-medium">PASS OFF</span>
  {discountCount > 0 && (
    <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse">
      {discountCount}
    </span>
  )}
</Link>
```

### 2. Hook para Productos con Descuento

**Archivo**: `src/hooks/useDiscountedProducts.ts`

**NOTA IMPORTANTE**: Este hook usa `activeDiscountsMap` que ya existe en `discountStore`. 
Este Map YA CONTIENE todos los productos con descuento activo (tanto directos como por drop).
El Map tiene la estructura: `Map<productId, { percentage, name, source }>`

```typescript
import { useMemo } from 'react';
import { useProductStore } from '../store/productStore';
import { useDiscountStore } from '../store/discountStore';

export const useDiscountedProducts = () => {
  const { products } = useProductStore();
  const { activeDiscountsMap } = useDiscountStore();

  const discountedProducts = useMemo(() => {
    return products
      .filter(product => activeDiscountsMap.has(product.id))
      .map(product => {
        const discountInfo = activeDiscountsMap.get(product.id)!;
        const originalPrice = product.price;
        const discountAmount = originalPrice * (discountInfo.percentage / 100);
        const finalPrice = originalPrice - discountAmount;
        
        return {
          ...product,
          discount: discountInfo,
          originalPrice,
          finalPrice,
          savings: discountAmount
        };
      })
      .sort((a, b) => b.discount.percentage - a.discount.percentage); // Mayor descuento primero
  }, [products, activeDiscountsMap]);

  return {
    discountedProducts,
    count: discountedProducts.length,
    totalSavings: discountedProducts.reduce((sum, p) => sum + p.savings, 0)
  };
};
```

**Explicación del Hook**:
1. Obtiene `products` del store de productos
2. Obtiene `activeDiscountsMap` del store de descuentos
3. Filtra solo productos que están en el Map (tienen descuento activo)
4. Calcula precio final y ahorro para cada producto
5. Ordena por mayor porcentaje de descuento primero
6. Retorna: array de productos con descuento, contador, y ahorro total

### 3. Dropdown en Navbar (Opcional)

**Archivo**: `src/components/discounts/DiscountDropdown.tsx`

```typescript
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Percent, ArrowRight, TrendingDown } from 'lucide-react';
import { useDiscountedProducts } from '../../hooks/useDiscountedProducts';

export const DiscountDropdown: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { discountedProducts, count } = useDiscountedProducts();
  
  // Mostrar solo los primeros 6 productos
  const previewProducts = discountedProducts.slice(0, 6);

  return (
    <div 
      className="relative"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      {/* Trigger */}
      <button className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-all">
        <Percent className="h-5 w-5" />
        <span className="font-bold">PASS OFF</span>
        {count > 0 && (
          <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
            {count}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && count > 0 && (
        <div className="absolute top-full left-0 mt-2 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 animate-slideDown">
          <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-red-50 to-orange-50">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-red-500" />
                Productos en Oferta
              </h3>
              <span className="text-sm text-red-600 font-medium">
                {count} productos
              </span>
            </div>
          </div>

          <div className="p-4 max-h-96 overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              {previewProducts.map((product) => (
                <Link
                  key={product.id}
                  to={`/products?highlight=${product.id}`}
                  className="group border border-gray-200 rounded-lg p-3 hover:border-red-500 hover:shadow-md transition-all"
                >
                  {/* Imagen */}
                  <div className="relative aspect-square bg-gray-100 rounded-lg mb-2 overflow-hidden">
                    {product.image_url ? (
                      <img 
                        src={product.image_url} 
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Percent className="h-8 w-8 text-gray-400" />
                      </div>
                    )}
                    {/* Badge de descuento */}
                    <div className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg">
                      -{product.discount.percentage}%
                    </div>
                  </div>

                  {/* Info */}
                  <h4 className="font-medium text-sm text-gray-900 truncate mb-1">
                    {product.name}
                  </h4>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-gray-400 line-through">
                      ${product.originalPrice.toFixed(2)}
                    </span>
                    <span className="text-base font-bold text-red-600">
                      ${product.finalPrice.toFixed(2)}
                    </span>
                  </div>
                  <div className="text-xs text-green-600 font-medium mt-1">
                    Ahorras ${product.savings.toFixed(2)}
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <Link
              to="/pass-off"
              className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold py-2 px-4 rounded-lg hover:from-red-600 hover:to-orange-600 transition-all"
            >
              Ver Todas las Ofertas
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
```

### 4. Página Pass Off Completa

**Archivo**: `src/pages/PassOffPage.tsx`

```typescript
import React, { useState, useMemo } from 'react';
import { TrendingDown, Percent, Calendar, Package, Search, Filter } from 'lucide-react';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import { useDiscountedProducts } from '../hooks/useDiscountedProducts';
import { DiscountPrice, DiscountBadge } from '../components/discounts/DiscountBadge';

const PassOffPage: React.FC = () => {
  const { discountedProducts, count, totalSavings } = useDiscountedProducts();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'percentage' | 'price' | 'name'>('percentage');

  // Filtrar y ordenar
  const filteredProducts = useMemo(() => {
    let filtered = discountedProducts;

    // Búsqueda
    if (searchTerm) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Ordenar
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'percentage':
          return b.discount.percentage - a.discount.percentage;
        case 'price':
          return a.finalPrice - b.finalPrice;
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

    return filtered;
  }, [discountedProducts, searchTerm, sortBy]);

  return (
    <div className="space-y-6 pb-8">
      {/* Header con gradiente */}
      <div className="relative overflow-hidden bg-gradient-to-r from-red-600 via-orange-600 to-red-600 rounded-2xl p-8 text-white shadow-xl">
        <div className="absolute inset-0 bg-black opacity-10"></div>
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <TrendingDown className="h-10 w-10" />
                <h1 className="text-4xl font-black uppercase tracking-tight">
                  PASS OFF
                </h1>
              </div>
              <p className="text-red-100 text-lg">
                🔥 Los mejores descuentos de la temporada
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-red-50 to-orange-50 border-red-200">
          <div className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-medium text-red-700">Productos en Oferta</p>
              <p className="text-3xl font-bold text-red-900">{count}</p>
            </div>
            <Package className="h-10 w-10 text-red-500 opacity-50" />
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <div className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-medium text-green-700">Ahorro Total Disponible</p>
              <p className="text-3xl font-bold text-green-900">${totalSavings.toFixed(2)}</p>
            </div>
            <Percent className="h-10 w-10 text-green-500 opacity-50" />
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
          <div className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-medium text-purple-700">Mayor Descuento</p>
              <p className="text-3xl font-bold text-purple-900">
                -{Math.max(...discountedProducts.map(p => p.discount.percentage))}%
              </p>
            </div>
            <TrendingDown className="h-10 w-10 text-purple-500 opacity-50" />
          </div>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar productos en oferta..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
          >
            <option value="percentage">Mayor descuento</option>
            <option value="price">Menor precio</option>
            <option value="name">Nombre A-Z</option>
          </select>
        </div>
      </Card>

      {/* Grid de Productos */}
      {filteredProducts.length === 0 ? (
        <Card className="text-center py-16 bg-gradient-to-br from-gray-50 to-gray-100">
          <div className="max-w-md mx-auto">
            <div className="bg-red-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
              <Percent className="h-10 w-10 text-red-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">
              {searchTerm ? 'No se encontraron productos' : 'No hay productos en oferta'}
            </h3>
            <p className="text-gray-600">
              {searchTerm
                ? 'Intenta con otros términos de búsqueda'
                : 'Crea descuentos en la sección de Descuentos para que aparezcan aquí'
              }
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredProducts.map((product) => (
            <Card
              key={product.id}
              className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-2 border-transparent hover:border-red-500"
            >
              <div className="relative">
                {/* Badge de descuento */}
                <div className="absolute top-2 right-2 z-10">
                  <DiscountBadge percentage={product.discount.percentage} />
                </div>

                {/* Imagen */}
                <div className="aspect-square bg-gray-100 rounded-t-lg overflow-hidden">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-12 w-12 text-gray-400" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 truncate mb-2">
                    {product.name}
                  </h3>
                  <p className="text-xs text-gray-500 mb-3">{product.category}</p>

                  {/* Precio */}
                  <DiscountPrice
                    originalPrice={product.originalPrice}
                    discountedPrice={product.finalPrice}
                  />

                  {/* Ahorro */}
                  <div className="mt-2 text-xs font-medium text-green-600 flex items-center gap-1">
                    <TrendingDown className="h-3 w-3" />
                    Ahorras ${product.savings.toFixed(2)}
                  </div>

                  {/* Nombre del descuento */}
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <p className="text-xs text-gray-600 truncate">
                      📌 {product.discount.name}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Info adicional */}
      {filteredProducts.length > 0 && (
        <Card className="bg-blue-50 border-blue-200 p-6">
          <div className="flex items-start gap-4">
            <div className="bg-blue-100 rounded-full p-3">
              <Calendar className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-blue-900 mb-2">
                💡 Tip: Descuentos limitados
              </h3>
              <p className="text-sm text-blue-800">
                Estos descuentos son por tiempo limitado. Los precios mostrados ya incluyen
                el descuento y se aplicarán automáticamente al realizar una venta.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default PassOffPage;
```

### 5. Agregar Ruta

**Archivo**: `src/App.tsx`

```typescript
// Agregar import
import PassOffPage from './pages/PassOffPage';

// Agregar ruta
<Route path="/pass-off" element={<PassOffPage />} />
```

---

## 🎨 Estilos CSS Adicionales

```css
/* Animación para el dropdown */
@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-slideDown {
  animation: slideDown 0.2s ease-out;
}

/* Badge pulsante */
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
```

---

## ✅ Funcionalidades Implementadas

1. ✅ **Link "PASS OFF" en Sidebar**
   - Color rojo/naranja destacado
   - Badge con contador de productos en oferta
   - Animación pulse en el badge

2. ✅ **Hook useDiscountedProducts**
   - Obtiene productos con descuento activo
   - Calcula precio final y ahorro
   - Ordena por mayor descuento

3. ✅ **Dropdown en Navbar (Opcional)**
   - Preview de 6 productos
   - Grid compacto 2 columnas
   - Link a página completa

4. ✅ **Página Pass Off Completa**
   - Header con gradiente rojo/naranja
   - Stats cards: productos, ahorro total, mayor descuento
   - Búsqueda y ordenamiento
   - Grid responsive de productos
   - Badges de descuento visibles
   - Precio con descuento destacado

5. ✅ **Integración con Sistema Existente**
   - Usa activeDiscountsMap del store
   - Compatible con descuentos por producto y drop
   - Se actualiza en tiempo real

---

## 🚀 Próximos Pasos

1. Copiar los componentes
2. Agregar la ruta en App.tsx
3. Actualizar Sidebar.tsx
4. Probar funcionalidad
5. Opcional: Agregar animaciones adicionales

---

## 🎯 Resultado Final

```
SIDEBAR:
├── Dashboard
├── Ventas
├── PASS OFF 🔥 [3]  ← NUEVO (rojo, con badge)
├── Productos
├── Drops
└── ...

PÁGINA PASS OFF:
- Header: "PASS OFF - Los mejores descuentos"
- Stats: X productos, $Y ahorro total, Z% mayor descuento
- Grid: Todos los productos con descuento
- Cada card muestra:
  * Badge: -XX%
  * Precio original tachado
  * Precio con descuento
  * Ahorro: "Ahorras $X"
```

---

**¡Listo! Esta funcionalidad permitirá a tus vendedores ver rápidamente todos los productos en oferta y cerrar ventas más fácilmente.**

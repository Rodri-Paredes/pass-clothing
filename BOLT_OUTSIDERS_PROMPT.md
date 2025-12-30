# 🛍️ OUTSIDERS - E-COMMERCE MINIMALISTA

Crea una tienda online moderna para OUTSIDERS con diseño minimalista oscuro estilo EMESTUDIOS.

## STACK
- React 18 + Vite + TypeScript + Tailwind CSS
- React Router para navegación
- Framer Motion para animaciones
- Zustand para carrito
- (Después configuraremos Supabase + pagos)

## DISEÑO
**Estilo:** Minimalista oscuro, tipografía bold, imágenes grandes, hover effects elegantes

**Colores:**
- Background: #0A0A0A (negro) y #1A1A1A (gris oscuro)
- Texto: #FFFFFF y #A0A0A0
- Bordes sutiles: #2A2A2A

**Tipografía:** Inter, uppercase para títulos, bold weights

## PÁGINAS ESENCIALES

### 1. HOME (/)
- **Hero:** Video/imagen full-screen, logo centrado, texto "NEW DROP", botón CTA
- **Featured Drops:** Grid 2 columnas, imágenes grandes con overlay, hover zoom
- **New Arrivals:** Grid asimétrico 3 columnas de productos
- **Newsletter:** Fondo negro, input minimal

### 2. SHOP (/shop)
- Título "SHOP" grande
- Grid 4 columnas responsive (2 en mobile)
- Filtros colapsables: categoría, talla, precio
- Productos con hover (segunda imagen fade in)

### 3. PRODUCT DETAIL (/shop/:slug)
**Layout:** 60% galería | 40% info

**Galería:** Imagen grande + thumbnails, click para zoom

**Info:**
- Nombre producto (H1 grande)
- Precio (muy grande, bold)
- Selector tallas (botones circulares)
- Botón "ADD TO CART" full width
- Descripción en acordeón

### 4. CART (Drawer lateral)
- Slide desde derecha
- Lista productos: imagen mini, nombre, talla, cantidad (+/-), precio
- Subtotal y botón "CHECKOUT"

### 5. CHECKOUT (/checkout)
**2 columnas:**
- Izquierda: Customer info, shipping, payment
- Derecha: Order summary sticky

## COMPONENTES CLAVE

### Navbar (fijo superior)
- Logo izquierda
- Links: SHOP | COLLECTIONS | ABOUT
- Iconos: Search, Cart (con badge), Account
- Fondo transparente → negro/80 con blur al scroll
- Hamburger en móvil

### ProductCard
```tsx
- Imagen aspect-ratio 3:4
- Hover: segunda imagen fade + quick view
- Info: título uppercase, precio bold
- Sin bordes, spacing generoso
```

### Footer (minimalista)
- 4 columnas: Shop, Help, Social, Newsletter
- Links simples, iconos sociales
- Copyright

## ANIMACIONES
- Hover transitions: 0.3s ease
- Scroll animations con Framer Motion
- Page transitions suaves
- Hover scale 1.02-1.05

## CONFIGURACIÓN INICIAL

```tsx
// tailwind.config.js
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: { primary: '#0A0A0A', secondary: '#1A1A1A' },
        text: { primary: '#FFFFFF', secondary: '#A0A0A0' },
        border: '#2A2A2A'
      }
    }
  }
}

// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
```

## ESTRUCTURA DEL PROYECTO
```
src/
├── pages/
│   ├── Home.tsx
│   ├── Shop.tsx
│   ├── ProductDetail.tsx
│   └── Checkout.tsx
├── components/
│   ├── layout/
│   │   ├── Navbar.tsx
│   │   ├── Footer.tsx
│   │   └── CartDrawer.tsx
│   ├── home/
│   │   ├── HeroSection.tsx
│   │   ├── FeaturedDrops.tsx
│   │   └── NewArrivals.tsx
│   ├── products/
│   │   ├── ProductCard.tsx
│   │   ├── ProductGrid.tsx
│   │   └── ProductGallery.tsx
│   └── ui/
│       ├── Button.tsx
│       └── Modal.tsx
├── store/
│   └── cartStore.ts (Zustand)
├── App.tsx (React Router setup)
└── main.tsx
```

## DATOS DE EJEMPLO
Usa productos de ejemplo de ropa streetwear con:
- Nombres cool (T-Shirt Oversized, Hoodie Essential, etc.)
- Precios $800-$2500
- Tallas: XS, S, M, L, XL
- 2 imágenes por producto
- Categorías: Remeras, Buzos, Pantalones, Accesorios

## PRIORIDADES
1. ✅ Setup Vite + React + Tailwind + React Router
2. ✅ Layout y navegación (Navbar, Footer)
3. ✅ Homepage con hero y productos
4. ✅ Shop con grid y filtros básicos
5. ✅ Product detail funcional
6. ✅ Carrito drawer con zustand
7. ⏳ Checkout page (después Supabase y Stripe)

**Empieza con el setup de Vite + React + Tailwind, React Router, componentes base y homepage. Hazlo minimalista, oscuro y elegante. 🖤**

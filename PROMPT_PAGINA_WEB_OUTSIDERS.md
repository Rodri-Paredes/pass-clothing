# 🛍️ PROMPT PÁGINA WEB OUTSIDERS - ESTILO EMESTUDIOS

Copia y pega este prompt completo en tu editor de código con IA:

---

## 📋 PROMPT PRINCIPAL

```
Necesito crear una página web e-commerce moderna para mi tienda de ropa "OUTSIDERS" 
con un diseño minimalista y elegante estilo EMESTUDIOS.

STACK TECNOLÓGICO:
- Frontend: Next.js 14+ (App Router) con TypeScript
- Styling: Tailwind CSS + Framer Motion
- Backend: Supabase (mismo de mi ERP)
- Estado: Zustand para carrito
- Pagos: Stripe o mercado Pago
- SEO: Next.js metadata API
- Imágenes: Next/Image con optimización
- Animaciones: Framer Motion + GSAP

DISEÑO ESTILO EMESTUDIOS:
- Minimalista y clean
- Fondo negro/gris oscuro dominante
- Tipografía grande y bold
- Imágenes hero full-screen
- Hover effects elegantes
- Micro-interacciones suaves
- Grid asimétrico para productos
- Espacios en blanco generosos
- Fotografía de producto de alta calidad
- Navegación fija transparente
- Footer minimalista

ESTRUCTURA DEL PROYECTO:
```
outsiders-web/
├── app/
│   ├── (storefront)/
│   │   ├── page.tsx                    # Homepage con hero + drops
│   │   ├── shop/
│   │   │   ├── page.tsx                # Catálogo completo
│   │   │   └── [slug]/
│   │   │       └── page.tsx            # Detalle de producto
│   │   ├── collections/
│   │   │   └── [slug]/
│   │   │       └── page.tsx            # Página de colección/drop
│   │   ├── cart/
│   │   │   └── page.tsx                # Carrito de compras
│   │   ├── checkout/
│   │   │   ├── page.tsx                # Checkout
│   │   │   └── success/
│   │   │       └── page.tsx            # Confirmación
│   │   ├── about/
│   │   │   └── page.tsx                # Sobre nosotros
│   │   └── contact/
│   │       └── page.tsx                # Contacto
│   ├── api/
│   │   ├── products/
│   │   │   └── route.ts                # API productos
│   │   ├── cart/
│   │   │   └── route.ts                # API carrito
│   │   └── checkout/
│   │       └── route.ts                # API checkout
│   ├── layout.tsx                      # Layout principal
│   └── globals.css                     # Estilos globales
├── components/
│   ├── layout/
│   │   ├── Navbar.tsx                  # Navegación principal
│   │   ├── Footer.tsx                  # Footer
│   │   └── MobileMenu.tsx              # Menú móvil
│   ├── home/
│   │   ├── HeroSection.tsx             # Hero con video/imagen
│   │   ├── FeaturedDrops.tsx           # Drops destacados
│   │   ├── NewArrivals.tsx             # Nuevos productos
│   │   └── Newsletter.tsx              # Suscripción newsletter
│   ├── products/
│   │   ├── ProductCard.tsx             # Tarjeta de producto
│   │   ├── ProductGrid.tsx             # Grid de productos
│   │   ├── ProductDetail.tsx           # Detalle completo
│   │   ├── ProductGallery.tsx          # Galería de imágenes
│   │   ├── ProductFilters.tsx          # Filtros y ordenamiento
│   │   └── QuickView.tsx               # Modal quick view
│   ├── cart/
│   │   ├── CartDrawer.tsx              # Drawer del carrito
│   │   ├── CartItem.tsx                # Item del carrito
│   │   └── CartSummary.tsx             # Resumen de compra
│   ├── checkout/
│   │   ├── CheckoutForm.tsx            # Formulario de checkout
│   │   ├── ShippingInfo.tsx            # Info de envío
│   │   └── PaymentMethod.tsx           # Método de pago
│   └── ui/
│       ├── Button.tsx                  # Botón con variantes
│       ├── Input.tsx                   # Input estilizado
│       ├── Modal.tsx                   # Modal genérico
│       ├── ImageZoom.tsx               # Zoom de imágenes
│       └── LoadingSpinner.tsx          # Loading states
├── lib/
│   ├── supabase.ts                     # Cliente Supabase
│   ├── stripe.ts                       # Cliente Stripe/MP
│   ├── types.ts                        # Tipos TypeScript
│   └── utils.ts                        # Utilidades
├── store/
│   └── cartStore.ts                    # Estado del carrito
├── hooks/
│   ├── useCart.ts                      # Hook del carrito
│   └── useProducts.ts                  # Hook de productos
└── public/
    ├── images/
    └── videos/
```

PÁGINA DE INICIO (HOMEPAGE):

1. HERO SECTION:
   - Video background o imagen hero full-screen
   - Logo grande centrado con animación de entrada
   - Texto minimal: "NEW DROP" o slogan
   - CTA button con efecto hover
   - Scroll indicator animado
   - Parallax effect suave

2. FEATURED DROPS:
   - Grid 2 columnas en desktop, 1 en mobile
   - Imágenes grandes con overlay oscuro
   - Título del drop en grande
   - Hover: Zoom suave + botón "SHOP NOW"
   - Animación de entrada staggered

3. NEW ARRIVALS:
   - Grid asimétrico de productos (2-3-2 pattern)
   - Imagen principal + hover muestra segunda foto
   - Precio grande y bold
   - Sin bordes, solo espacios
   - Quick add to cart en hover

4. ABOUT PREVIEW:
   - Sección con imagen lateral + texto
   - Filosofía de la marca
   - Link a página About

5. NEWSLETTER:
   - Fondo negro completo
   - Input minimal con borde
   - "STAY UPDATED" en grande
   - Solo email, submit invisible

PÁGINA DE CATÁLOGO (/shop):

- Header con título "SHOP" grande
- Filtros laterales colapsables:
  * Categoría
  * Talla
  * Precio
  * Color
- Ordenamiento: Newest, Price Low-High, High-Low
- Grid responsive: 4 cols desktop, 2 mobile
- Paginación infinita o numbered
- Animación de entrada para cada producto
- Sticky filters en desktop

DETALLE DE PRODUCTO:

Layout: 60% Gallery | 40% Info

GALERÍA:
- Imagen principal grande
- Thumbnails verticales a la izquierda
- Click para zoom
- Swipe en móvil
- Lightbox opcional

INFO:
- Nombre del producto (H1, grande)
- Precio (muy grande, bold)
- Descripción detallada
- Selector de talla (buttons circulares)
- Indicador de stock "Only X left"
- Botón "ADD TO CART" full width
- Acordeón con:
  * Detalles del producto
  * Guía de tallas
  * Envío y devoluciones

PRODUCTOS RELACIONADOS:
- "YOU MAY ALSO LIKE"
- Horizontal scroll
- 4-6 productos

CARRITO (Drawer lateral):

- Slide desde la derecha
- Overlay oscuro
- Lista de productos con:
  * Imagen pequeña
  * Nombre y talla
  * Cantidad (+/-)
  * Precio
  * Eliminar (X)
- Subtotal
- Botón "CHECKOUT" destacado
- Link "Continue Shopping"
- Animación smooth al abrir/cerrar

CHECKOUT:

Diseño 2 columnas:

IZQUIERDA (60%):
1. Customer Information
   - Email
   - First name / Last name
2. Shipping Address
   - Address
   - City / State / ZIP
   - Country
3. Payment Method
   - Stripe Elements o MP
   - Tarjeta / Transferencia

DERECHA (40%):
- Order Summary sticky
- Lista de productos mini
- Subtotal
- Shipping
- Total (grande)

SUCCESS PAGE:
- Checkmark animado
- "ORDER CONFIRMED"
- Número de orden
- Email de confirmación
- CTA "Continue Shopping"

ESTILOS ESPECÍFICOS ESTILO EMESTUDIOS:

```css
/* COLORES */
--bg-primary: #0A0A0A;       /* Negro principal */
--bg-secondary: #1A1A1A;     /* Gris oscuro */
--text-primary: #FFFFFF;     /* Blanco */
--text-secondary: #A0A0A0;   /* Gris claro */
--accent: #FFFFFF;           /* Acento minimalista */
--border: #2A2A2A;           /* Bordes sutiles */

/* TIPOGRAFÍA */
font-family: 'Inter', 'Helvetica Neue', sans-serif;
- H1: 72px / 900 weight / uppercase / tracking-tight
- H2: 48px / 800 weight / uppercase
- H3: 32px / 700 weight
- Body: 16px / 400 weight / line-height: 1.6
- Price: 24px / 600 weight

/* ESPACIADO */
- Secciones: 120px padding vertical
- Grid gap: 40px desktop, 20px mobile
- Container max-width: 1400px
- Padding lateral: 80px desktop, 20px mobile

/* ANIMACIONES */
- Hover transitions: 0.3s cubic-bezier(0.4, 0, 0.2, 1)
- Page transitions: 0.5s ease
- Scroll animations: intersection observer
- Hover scale: 1.02-1.05
- Image hover: opacity 0.8

/* EFECTOS */
- Backdrop blur en navbar: blur(10px)
- Box shadow minimal: 0 4px 20px rgba(0,0,0,0.1)
- Bordes: 1px solid var(--border)
- Border radius: 0px (square) o 2px (minimal)
```

COMPONENTES CLAVE:

1. NAVBAR:
```tsx
- Posición: fixed top
- Fondo: transparente scroll → bg-black/80 blur
- Logo izquierda
- Links centro: SHOP | COLLECTIONS | ABOUT
- Iconos derecha: Search | Cart (con badge) | Account
- Móvil: Hamburger menu
- Animación: slide down on scroll up
```

2. PRODUCT CARD:
```tsx
- Imagen: aspect-ratio 3:4
- Hover: segunda imagen fade in
- Info overlay bottom en hover
- Título: uppercase, 14px
- Precio: 18px, bold
- Quick view button
- Sin bordes visibles
```

3. FOOTER:
```tsx
4 columnas desktop:
- Logo + descripción
- SHOP (links categorías)
- INFO (About, Contact, FAQ)
- FOLLOW US (Instagram, TikTok)
- Newsletter input
- Copyright + Políticas
Móvil: stack vertical
```

FUNCIONALIDADES:

1. CATÁLOGO:
   - Mostrar solo productos visibles (visible = true)
   - Filtrar por categoría y drop
   - Mostrar solo tallas con stock > 0
   - Lazy loading de imágenes
   - Búsqueda en tiempo real

2. CARRITO:
   - Persistencia con localStorage + Zustand
   - Validación de stock en tiempo real
   - Actualizar cantidades
   - Calcular total automático
   - Animaciones al agregar items

3. CHECKOUT:
   - Validación de formulario
   - Integración con Stripe/Mercado Pago
   - Verificar stock antes de pagar
   - Crear orden en Supabase
   - Enviar email de confirmación
   - Actualizar stock después de compra

4. SEO:
   - Metadata dinámica por página
   - Open Graph tags
   - Schema.org markup para productos
   - Sitemap.xml
   - robots.txt

INTEGRACIONES SUPABASE:

Usar las mismas tablas del ERP:
- products (con visible = true)
- product_variants (stock disponible)
- drops (drops activos)
- branches (info de tiendas)

Crear nuevas tablas:
- online_orders (pedidos web)
- order_items (items del pedido)
- customers (datos de clientes)

```sql
-- Nueva tabla para pedidos online
CREATE TABLE online_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  shipping_address JSONB NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  shipping_cost DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  payment_method TEXT NOT NULL,
  payment_status TEXT DEFAULT 'pending',
  order_status TEXT DEFAULT 'processing',
  stripe_payment_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES online_orders(id),
  product_variant_id UUID REFERENCES product_variants(id),
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL
);
```

ANIMACIONES CON FRAMER MOTION:

```tsx
// Page transitions
const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
};

// Product card hover
const cardVariants = {
  initial: { scale: 1 },
  hover: { scale: 1.05 }
};

// Stagger children
const containerVariants = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};
```

RESPONSIVE:

Breakpoints:
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

Mobile-first approach:
- Stack vertical por defecto
- Grid 1 columna → 2 → 4
- Navbar hamburger < 768px
- Carrito full-screen < 640px
- Touch-friendly buttons (min 44px)

OPTIMIZACIONES:

1. IMÁGENES:
   - Next/Image con blur placeholder
   - WebP con fallback
   - Lazy loading
   - Responsive sizes
   - CDN (Supabase Storage)

2. PERFORMANCE:
   - Code splitting por ruta
   - Dynamic imports
   - React.memo para cards
   - Debounce en búsqueda (300ms)
   - Infinite scroll con intersection observer

3. SEO:
   - Server components por defecto
   - Metadata en cada page
   - Structured data
   - Canonical URLs
   - Alt text en imágenes

EXTRAS:

- [ ] Wishlist (guardar favoritos)
- [ ] Product reviews
- [ ] Size guide modal
- [ ] Instagram feed
- [ ] Gift cards
- [ ] Discount codes
- [ ] Email marketing (Resend/Mailchimp)
- [ ] Analytics (Google/Vercel)
- [ ] Chat en vivo
- [ ] Multi-idioma

EMPEZAR POR:

1. Setup Next.js 14 con TypeScript + Tailwind
2. Conectar Supabase (mismo proyecto del ERP)
3. Crear Layout + Navbar + Footer
4. Implementar Homepage con hero
5. Página de catálogo con filtros
6. Detalle de producto
7. Carrito con Zustand
8. Checkout con Stripe/MP
9. Success page
10. Optimizaciones y animaciones

COMANDOS:

```bash
# Crear proyecto
npx create-next-app@latest outsiders-web --typescript --tailwind --app

# Instalar dependencias
npm install @supabase/supabase-js zustand framer-motion
npm install @stripe/stripe-js stripe  # o mercadopago
npm install lucide-react react-hook-form zod
npm install swiper  # para galería
npm install sharp  # para optimización de imágenes

# Dev
npm run dev
```

REFERENCIAS DE DISEÑO:

Inspiración estilo EMESTUDIOS:
- Fondo oscuro dominante
- Tipografía grande y bold
- Imágenes hero impactantes
- Grid asimétrico
- Minimal UI
- Espacios en blanco generosos
- Hover effects sutiles
- Animaciones smooth
- Mobile-first responsive

Marcas de referencia:
- EMESTUDIOS
- PALACE
- GOLF WANG
- STÜSSY
- NOAH

¡Genera el proyecto completo con esta estructura minimalista y moderna!
```

---

## 🎨 PALETA DE COLORES EXACTA

```css
:root {
  /* Backgrounds */
  --black: #0A0A0A;
  --gray-dark: #1A1A1A;
  --gray-medium: #2A2A2A;
  
  /* Text */
  --white: #FFFFFF;
  --gray-light: #A0A0A0;
  --gray-lighter: #D0D0D0;
  
  /* Accents */
  --accent-primary: #FFFFFF;
  --accent-hover: #E5E5E5;
  
  /* States */
  --success: #4ADE80;
  --error: #EF4444;
  --warning: #F59E0B;
  
  /* Transparent */
  --overlay: rgba(0, 0, 0, 0.5);
  --glass: rgba(255, 255, 255, 0.05);
}
```

---

## 📱 MOCKUPS DE REFERENCIA

### HOMEPAGE STRUCTURE:
```
┌─────────────────────────────────┐
│  [LOGO]  SHOP  DROPS  [🔍 🛒]  │ ← Navbar fixed
├─────────────────────────────────┤
│                                 │
│         [HERO VIDEO]            │ ← Full viewport
│      NEW DROP AVAILABLE         │
│        [SHOP NOW →]             │
│                                 │
├─────────────────────────────────┤
│  FEATURED COLLECTIONS           │
│  ┌──────────┐  ┌──────────┐   │
│  │          │  │          │   │ ← 2 cols grid
│  │  WINTER  │  │  SUMMER  │   │
│  └──────────┘  └──────────┘   │
├─────────────────────────────────┤
│  NEW ARRIVALS                   │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐  │
│  │    │ │    │ │    │ │    │  │ ← 4 cols grid
│  └────┘ └────┘ └────┘ └────┘  │
├─────────────────────────────────┤
│  [NEWSLETTER]                   │
└─────────────────────────────────┘
```

### PRODUCT DETAIL:
```
┌─────────────────────────────────┐
│  [LOGO]  SHOP  DROPS  [🔍 🛒]  │
├──────────────┬──────────────────┤
│              │  PRODUCT NAME    │
│   [IMAGES]   │  $99.00          │
│              │                  │
│  [thumbs]    │  Description...  │
│              │                  │
│              │  SIZE: [XS][S]   │
│              │  [ADD TO CART]   │
└──────────────┴──────────────────┘
```

---

## 🔌 INTEGRACIÓN CON ERP

La página web debe conectarse al mismo Supabase del ERP:

1. **Productos**: Leer de la tabla `products` donde `visible = true`
2. **Stock**: Validar disponibilidad en `product_variants`
3. **Drops**: Mostrar drops activos
4. **Órdenes**: Crear en nueva tabla `online_orders`
5. **Sincronización**: Las ventas web actualizan el stock del ERP

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

- [ ] Setup Next.js 14 con App Router
- [ ] Configurar Tailwind con tema oscuro
- [ ] Conectar Supabase (mismo del ERP)
- [ ] Navbar con carrito y búsqueda
- [ ] Hero section con video/imagen
- [ ] Featured drops section
- [ ] Catálogo con filtros
- [ ] Detalle de producto con galería
- [ ] Sistema de carrito con Zustand
- [ ] Checkout con Stripe/Mercado Pago
- [ ] Success page
- [ ] Newsletter signup
- [ ] Footer completo
- [ ] Responsive mobile
- [ ] Animaciones con Framer Motion
- [ ] SEO y metadata
- [ ] Optimización de imágenes
- [ ] Testing y deployment

---

**¡LISTO! Este prompt generará una página web moderna estilo EMESTUDIOS para OUTSIDERS, integrada con tu ERP de Supabase.**

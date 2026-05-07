# 🏪 PROMPT COMPLETO PARA CREAR ERP OUTSIDERS

Copia y pega este prompt en tu editor de código (GitHub Copilot, Cursor, o cualquier IDE con IA):

---

## 📋 PROMPT PRINCIPAL

```
Necesito crear un ERP completo para mi tienda de ropa "OUTSIDERS" usando React + TypeScript + Vite + Supabase.

REQUISITOS TÉCNICOS:
- Frontend: React 18+ con TypeScript
- Build tool: Vite
- Styling: Tailwind CSS
- Backend: Supabase (PostgreSQL + Auth + Storage)
- Estado: Zustand para manejo de estado global
- Routing: React Router v6
- Iconos: Lucide React
- Validación: Formularios con validación en tiempo real

ESTRUCTURA DEL PROYECTO:
```
outsiders-erp/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx          # Navbar con usuario y sucursal
│   │   │   ├── Sidebar.tsx         # Menú lateral de navegación
│   │   │   └── Layout.tsx          # Layout principal
│   │   ├── products/
│   │   │   ├── ProductForm.tsx     # Formulario para crear/editar productos
│   │   │   ├── ProductCard.tsx     # Tarjeta de producto
│   │   │   └── ProductList.tsx     # Lista de productos
│   │   ├── sales/
│   │   │   ├── SalesForm.tsx       # Formulario de venta con carrito
│   │   │   ├── PaymentModal.tsx    # Modal para pagos mixtos
│   │   │   └── SaleReceipt.tsx     # Comprobante de venta
│   │   ├── drops/
│   │   │   ├── DropForm.tsx        # Crear/editar lanzamientos
│   │   │   ├── DropCard.tsx        # Tarjeta de drop
│   │   │   └── DropManager.tsx     # Gestor de productos en drop
│   │   ├── cash/
│   │   │   ├── CashRegister.tsx    # Control de caja
│   │   │   ├── OpenCashModal.tsx   # Modal apertura de caja
│   │   │   └── CloseCashModal.tsx  # Modal cierre de caja
│   │   └── ui/
│   │       ├── Button.tsx          # Botón reutilizable
│   │       ├── Input.tsx           # Input con validación
│   │       ├── Modal.tsx           # Modal genérico
│   │       ├── Card.tsx            # Card genérico
│   │       └── Select.tsx          # Select reutilizable
│   ├── pages/
│   │   ├── LoginPage.tsx           # Login con Supabase Auth
│   │   ├── BranchSelectionPage.tsx # Selección de sucursal
│   │   ├── DashboardPage.tsx       # Dashboard con estadísticas
│   │   ├── ProductsPage.tsx        # Gestión de productos
│   │   ├── SalesPage.tsx           # Realizar ventas
│   │   ├── DropsPage.tsx           # Gestión de drops/colecciones
│   │   ├── StockPage.tsx           # Control de inventario
│   │   └── ReportsPage.tsx         # Reportes y análisis
│   ├── services/
│   │   ├── authService.ts          # Servicios de autenticación
│   │   ├── productService.ts       # CRUD de productos
│   │   ├── salesService.ts         # CRUD de ventas
│   │   ├── dropService.ts          # CRUD de drops
│   │   ├── stockService.ts         # Gestión de stock
│   │   └── cashService.ts          # Gestión de caja
│   ├── store/
│   │   ├── authStore.ts            # Estado de autenticación
│   │   ├── cartStore.ts            # Carrito de compras
│   │   └── uiStore.ts              # Estado de UI (modals, etc)
│   ├── lib/
│   │   ├── supabase.ts             # Cliente de Supabase
│   │   ├── types.ts                # Tipos TypeScript
│   │   └── constants.ts            # Constantes de la app
│   ├── hooks/
│   │   ├── useAuth.ts              # Hook de autenticación
│   │   └── useDebounce.ts          # Hook para debounce
│   ├── App.tsx                     # Componente principal
│   └── main.tsx                    # Entry point
├── supabase/
│   └── migrations/
│       └── schema.sql              # Schema de base de datos (lo tengo)
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

FUNCIONALIDADES REQUERIDAS:

1. AUTENTICACIÓN Y USUARIOS:
   - Login con email/password (Supabase Auth)
   - Registro de nuevos usuarios
   - Roles: admin (acceso total) y vendedor (solo su sucursal)
   - Selección de sucursal activa
   - Logout

2. GESTIÓN DE PRODUCTOS:
   - CRUD completo de productos
   - Subida de imágenes (Supabase Storage)
   - Categorías personalizables
   - Variantes por talla (XS, S, M, L, XL, XXL)
   - Precio único por producto
   - Búsqueda y filtros por categoría
   - Visibilidad (ocultar/mostrar productos)

3. INVENTARIO (STOCK):
   - Stock por variante y sucursal
   - Actualización manual de stock
   - Transferencias entre sucursales
   - Alertas de stock bajo
   - Historial de movimientos

4. SISTEMA DE VENTAS:
   - Carrito de compras con búsqueda de productos
   - Selección de tallas disponibles en stock
   - Descuentos manuales por venta
   - Pagos: EFECTIVO, QR, TARJETA, MIXTO
   - Para pagos mixtos: separar montos por método
   - Actualización automática de stock
   - Registro en sistema de caja
   - Comprobante de venta

5. DROPS/LANZAMIENTOS:
   - Crear colecciones especiales
   - Asignar productos a drops
   - Destacar drops en página principal
   - Ordenar productos dentro del drop
   - Estados: ACTIVO, INACTIVO, FINALIZADO
   - Fechas de inicio y fin

6. CONTROL DE CAJA:
   - Apertura de caja con fondo inicial
   - Registro automático de ventas
   - Movimientos manuales (ingresos/egresos)
   - Cierre de caja con:
     * Desglose por método de pago (EFECTIVO, QR, TARJETA)
     * Monto esperado vs real
     * Diferencias (faltantes/sobrantes)
   - Historial de cajas cerradas
   - Solo una caja abierta por sucursal

7. DASHBOARD Y REPORTES:
   - Ventas del día/semana/mes
   - Productos más vendidos
   - Ventas por método de pago
   - Gráficos con Chart.js o Recharts
   - Filtros por fecha y sucursal
   - Exportar reportes

8. UI/UX:
   - Responsive (mobile-first)
   - Dark mode opcional
   - Notificaciones toast
   - Loaders y estados de carga
   - Validación de formularios
   - Confirmaciones antes de eliminar
   - Shortcuts de teclado para ventas

CONFIGURACIÓN DE SUPABASE:
- URL del proyecto: process.env.VITE_SUPABASE_URL
- Anon key: process.env.VITE_SUPABASE_ANON_KEY
- El schema SQL ya está creado y listo para ejecutar

ESTILOS Y DISEÑO:
- Paleta de colores moderna (negro, blanco, grises, un color de acento)
- Fuente: Inter o similar
- Espaciado consistente
- Bordes redondeados
- Sombras sutiles
- Animaciones suaves

FUNCIONES DE SUPABASE A USAR:
- open_cash_register(branch_id, opening_amount, notes)
- close_cash_register(cash_register_id, closing_amount, notes)
- register_sale_movement(sale_id)
- get_open_cash_register(branch_id)
- get_cash_register_summary(cash_register_id)
- get_mixed_payment_breakdown(branch_id, date)
- get_sales_with_discounts(branch_id, date)
- get_drop_products(drop_id)
- get_active_drops()
- get_dashboard_stats(branch_id, start_date, end_date)

VALIDACIONES IMPORTANTES:
- No vender sin stock disponible
- No cerrar caja si hay ventas pendientes
- No permitir montos negativos
- Validar que la suma de pagos mixtos coincida con el total
- No permitir eliminar productos con stock > 0

OPTIMIZACIONES:
- Lazy loading de imágenes
- Paginación en listas largas
- Debounce en búsquedas
- Caché de datos frecuentes
- React.memo para componentes pesados

EMPEZAR POR:
1. Configurar Vite + React + TypeScript + Tailwind
2. Configurar Supabase client
3. Crear tipos TypeScript basados en el schema
4. Implementar autenticación
5. Crear layout principal
6. Implementar página de ventas (funcionalidad principal)
7. Agregar resto de funcionalidades

¿Puedes generar el proyecto completo con esta estructura?
```

---

## 📝 PROMPTS ADICIONALES ESPECÍFICOS

### Para configuración inicial:
```
Configura un proyecto Vite + React + TypeScript con Tailwind CSS.
Incluye Zustand, React Router v6, Lucide React.
Crea el archivo de configuración de Supabase en src/lib/supabase.ts
con variables de entorno VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.
```

### Para tipos TypeScript:
```
Basándote en este schema SQL de Supabase, genera todos los tipos TypeScript
necesarios en src/lib/types.ts. Incluye tipos para:
- Branch, User, Product, ProductVariant, Stock, Sale, SaleItem
- Drop, DropProduct, CashRegister, CashMovement
- Tipos auxiliares para formularios y respuestas de API
```

### Para el sistema de ventas:
```
Crea un componente SalesPage.tsx completo que incluya:
- Búsqueda de productos con debounce
- Carrito de compras con gestión de cantidades
- Selección de tallas según stock disponible
- Aplicación de descuentos
- Modal de pago con soporte para pagos mixtos
- Actualización automática de stock al confirmar venta
- Comprobante de venta imprimible
```

### Para el control de caja:
```
Implementa un componente CashRegister.tsx con:
- Botón para abrir caja (modal con fondo inicial)
- Vista de caja abierta con resumen en tiempo real
- Lista de movimientos del día
- Botón para cerrar caja con desglose completo
- Solo permitir una caja abierta por sucursal
- Usar las funciones de Supabase: open_cash_register, close_cash_register, etc.
```

### Para el dashboard:
```
Crea un Dashboard con:
- Cards mostrando: ventas del día, número de transacciones, ticket promedio
- Gráfico de ventas de los últimos 7 días
- Top 5 productos más vendidos
- Desglose por método de pago
- Usa la función get_dashboard_stats de Supabase
- Integra Recharts para los gráficos
```

### Para gestión de productos:
```
Implementa ProductsPage.tsx con:
- Tabla/Grid de productos con imágenes
- Botón para crear nuevo producto
- Modal de formulario con:
  * Nombre, descripción, categoría, precio
  * Upload de imagen a Supabase Storage
  * Agregar múltiples tallas
  * Toggle de visibilidad
- Edición inline o modal
- Eliminación con confirmación
- Búsqueda y filtros por categoría
```

---

## 🔑 VARIABLES DE ENTORNO

Crea un archivo `.env` con:
```
VITE_SUPABASE_URL=tu_url_de_supabase
VITE_SUPABASE_ANON_KEY=tu_anon_key
```

---

## 📦 DEPENDENCIAS PRINCIPALES

```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.2",
    "@supabase/supabase-js": "^2.45.4",
    "zustand": "^4.5.5",
    "lucide-react": "^0.441.0",
    "recharts": "^2.12.7",
    "react-hot-toast": "^2.4.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.5.3",
    "vite": "^5.4.2",
    "tailwindcss": "^3.4.11",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47"
  }
}
```

---

## 🗄️ SCHEMA DE BASE DE DATOS

Ya tienes el archivo: `supabase/migrations/20251214_outsiders_complete_schema.sql`

Solo ejecuta este SQL en el editor SQL de Supabase para crear toda la base de datos.

---

## 🎯 CARACTERÍSTICAS CLAVE A IMPLEMENTAR

1. ✅ Login seguro con Supabase Auth
2. ✅ Selección de sucursal al iniciar
3. ✅ Ventas con carrito y pagos mixtos
4. ✅ Control de caja (apertura/cierre)
5. ✅ Gestión de productos con imágenes
6. ✅ Sistema de drops/colecciones
7. ✅ Control de stock por sucursal
8. ✅ Dashboard con estadísticas
9. ✅ Reportes por fecha
10. ✅ Responsive design

---

## 💡 CONSEJOS PARA LA IA

- Usa componentes reutilizables
- Implementa manejo de errores robusto
- Agrega estados de carga en todas las operaciones async
- Usa tipos TypeScript estrictos
- Implementa validaciones client-side y server-side (RLS)
- Optimiza las queries de Supabase
- Usa React Query o SWR para caché si es necesario
- Implementa infinite scroll en listas largas

---

## 🚀 COMANDOS PARA EMPEZAR

```bash
# Crear proyecto
npm create vite@latest outsiders-erp -- --template react-ts
cd outsiders-erp

# Instalar dependencias
npm install

# Instalar Tailwind
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# Instalar dependencias del proyecto
npm install @supabase/supabase-js zustand react-router-dom lucide-react recharts react-hot-toast

# Iniciar desarrollo
npm run dev
```

---

## 📱 PANTALLAS PRINCIPALES

1. **Login** → Email/Password + Registro
2. **Selección de Sucursal** → Grid con sucursales disponibles
3. **Dashboard** → Estadísticas y gráficos
4. **Productos** → CRUD de productos con imágenes
5. **Ventas** → Carrito + Pago + Comprobante
6. **Stock** → Control de inventario por sucursal
7. **Drops** → Gestión de colecciones
8. **Caja** → Apertura/Cierre y movimientos
9. **Reportes** → Análisis de ventas

---

## 🎨 PALETA DE COLORES SUGERIDA

```css
:root {
  --primary: #000000;        /* Negro principal */
  --secondary: #FFFFFF;      /* Blanco */
  --accent: #FF6B35;         /* Naranja/Rojo (ajustar según marca) */
  --gray-100: #F7F7F7;
  --gray-200: #E5E5E5;
  --gray-300: #D4D4D4;
  --gray-700: #404040;
  --gray-900: #171717;
  --success: #10B981;
  --error: #EF4444;
  --warning: #F59E0B;
}
```

---

## ✨ BONUS: FEATURES AVANZADAS

- [ ] Notificaciones push para alertas de stock
- [ ] Exportar reportes a PDF/Excel
- [ ] Código de barras para productos
- [ ] Scanner de QR para pagos
- [ ] Estadísticas de vendedores
- [ ] Metas de ventas mensuales
- [ ] Sistema de devoluciones
- [ ] Programa de fidelidad
- [ ] Multi-moneda
- [ ] Modo offline con sincronización

---

**¡LISTO! Copia este prompt y pégalo en tu editor de código con IA para que genere todo el proyecto automáticamente.**

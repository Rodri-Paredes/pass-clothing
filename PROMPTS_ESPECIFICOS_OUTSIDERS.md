# 🎯 PROMPTS ESPECÍFICOS PARA OUTSIDERS ERP

Usa estos prompts uno por uno en tu editor con IA para construir el ERP paso a paso.

---

## 1️⃣ CONFIGURACIÓN INICIAL DEL PROYECTO

```
Crea un proyecto Vite + React + TypeScript desde cero con la siguiente configuración:

1. Inicializa con: npm create vite@latest outsiders-erp -- --template react-ts

2. Configura Tailwind CSS:
   - Instala: tailwindcss, postcss, autoprefixer
   - Configura tailwind.config.js con:
     * Paleta de colores: primary (negro), secondary (blanco), accent (naranja #FF6B35)
     * Fuente: Inter
     * Extend spacing, borderRadius, shadows
   - Configura src/index.css con las directivas de Tailwind

3. Estructura de carpetas:
   src/
   ├── components/
   │   ├── layout/
   │   ├── products/
   │   ├── sales/
   │   ├── drops/
   │   ├── cash/
   │   └── ui/
   ├── pages/
   ├── services/
   ├── store/
   ├── lib/
   ├── hooks/
   └── utils/

4. Instala dependencias:
   npm install @supabase/supabase-js zustand react-router-dom lucide-react recharts react-hot-toast date-fns

5. Configura variables de entorno:
   - Crea .env con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
   - Crea .env.example con placeholders

6. Configura TypeScript estricto en tsconfig.json

Dame todos los archivos de configuración completos.
```

---

## 2️⃣ CLIENTE DE SUPABASE Y TIPOS

```
Crea la configuración de Supabase para el proyecto Outsiders ERP:

1. Archivo src/lib/supabase.ts:
   - Crea cliente de Supabase usando createClient
   - Exporta constante 'supabase'
   - Usa variables de entorno VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY

2. Archivo src/lib/types.ts con TODOS los tipos TypeScript:
   
   Database Types:
   - Branch: id, name, address, created_at
   - User: id, name, email, role ('admin' | 'vendedor'), branch_id, created_at
   - Product: id, name, description, category, price, image_url, drop_id, is_visible, created_at
   - ProductVariant: id, product_id, size, created_at
   - Stock: id, variant_id, branch_id, quantity, created_at, updated_at
   - Sale: id, user_id, branch_id, subtotal, discount_amount, total, payment_type, payment_details, sale_date, created_at
   - SaleItem: id, sale_id, variant_id, quantity, unit_price, subtotal
   - Drop: id, name, description, launch_date, end_date, status, is_featured, image_url, banner_url, created_at, updated_at
   - DropProduct: id, drop_id, product_id, is_featured, sort_order, created_at
   - CashRegister: id, branch_id, user_id, status, opening_date, opening_amount, opening_user_id, opening_notes, closing_date, closing_amount, closing_user_id, closing_notes, expected_cash, expected_qr, expected_card, expected_total, cash_difference, created_at, updated_at
   - CashMovement: id, cash_register_id, movement_type, payment_type, amount, description, reference_id, reference_type, user_id, created_at

   Form Types:
   - ProductFormData
   - SaleFormData
   - DropFormData
   - CashRegisterFormData
   
   Extended Types:
   - ProductWithVariants (Product + variants[])
   - ProductWithStock (Product + variants con stock)
   - SaleWithItems (Sale + items[])
   - DropWithProducts (Drop + products[])
   - CashRegisterWithMovements (CashRegister + movements[])
   
   API Response Types:
   - ApiResponse<T>
   - PaginatedResponse<T>
   
   Payment Types:
   - PaymentType: 'EFECTIVO' | 'QR' | 'TARJETA' | 'MIXTO'
   - PaymentDetails: { efectivo?: number; qr?: number; tarjeta?: number }
   - DropStatus: 'ACTIVO' | 'INACTIVO' | 'FINALIZADO'
   - CashRegisterStatus: 'ABIERTA' | 'CERRADA'
   - MovementType: 'INGRESO' | 'EGRESO'

3. Archivo src/lib/constants.ts:
   - CATEGORIES: array de categorías de productos
   - SIZES: array de tallas disponibles
   - PAYMENT_TYPES: tipos de pago
   - ROLES: roles de usuario

Dame el código completo de estos 3 archivos.
```

---

## 3️⃣ SISTEMA DE AUTENTICACIÓN

```
Implementa el sistema de autenticación completo para Outsiders ERP:

1. Store de autenticación (src/store/authStore.ts):
   - Usa Zustand
   - Estado: user, activeBranch, isLoading, isAuthenticated
   - Acciones:
     * login(email, password)
     * logout()
     * loadUser() - cargar usuario desde sesión
     * setActiveBranch(branch)
     * checkAuth() - verificar si está autenticado
   - Usa Supabase Auth
   - Maneja errores con try/catch

2. Servicio de autenticación (src/services/authService.ts):
   - login(email, password)
   - logout()
   - getCurrentUser()
   - getUserProfile(userId)
   - createUserProfile(user)
   - updateUserProfile(userId, updates)
   - Usa queries de Supabase

3. Página de Login (src/pages/LoginPage.tsx):
   - Formulario con email y password
   - Validación de campos
   - Botón de login con estado de carga
   - Mensaje de error si falla
   - Link a registro (opcional)
   - Redirecciona a /branch-selection después del login
   - Diseño moderno con Tailwind
   - Logo de Outsiders centrado

4. Página de selección de sucursal (src/pages/BranchSelectionPage.tsx):
   - Carga todas las sucursales
   - Grid de cards clickeables
   - Cada card muestra: nombre, dirección
   - Al seleccionar: guarda en authStore y redirige a /dashboard
   - Solo visible después del login
   - Admins pueden cambiar de sucursal desde el header

5. Hook useAuth (src/hooks/useAuth.ts):
   - Hook que retorna el estado de authStore
   - isAuthenticated, user, activeBranch
   - login, logout, setActiveBranch

Dame el código completo de estos archivos con manejo de errores robusto.
```

---

## 4️⃣ LAYOUT Y NAVEGACIÓN

```
Crea el sistema de layout y navegación para Outsiders ERP:

1. Layout principal (src/components/layout/Layout.tsx):
   - Estructura: Header + Sidebar + Content
   - Responsive: sidebar oculto en mobile, botón hamburguesa
   - Outlet de React Router para children
   - Padding y espaciado consistente

2. Header (src/components/layout/Header.tsx):
   - Logo "OUTSIDERS" a la izquierda
   - Nombre de sucursal activa en el centro
   - Menú de usuario a la derecha con:
     * Nombre del usuario
     * Rol (admin/vendedor)
     * Dropdown con:
       - Cambiar sucursal (solo admin)
       - Configuración
       - Cerrar sesión
   - Botón hamburguesa para mobile
   - Background negro, texto blanco

3. Sidebar (src/components/layout/Sidebar.tsx):
   - NavLinks de React Router
   - Iconos de Lucide React
   - Links principales:
     * Dashboard (LayoutDashboard)
     * Ventas (ShoppingCart)
     * Productos (Package)
     * Drops (Sparkles)
     * Stock (Database)
     * Caja (Wallet)
     * Reportes (BarChart3)
   - Link activo destacado con color accent
   - Cierra automáticamente en mobile al hacer click
   - Smooth transitions

4. Componentes UI base (src/components/ui/):
   
   Button.tsx:
   - Props: children, onClick, variant ('primary' | 'secondary' | 'danger'), size, disabled, loading, icon
   - Estilos con Tailwind
   - Spinner cuando loading=true
   - Variantes con diferentes colores
   
   Input.tsx:
   - Props: label, type, value, onChange, error, placeholder, required, disabled
   - Muestra mensaje de error debajo
   - Icono opcional
   - Focus ring con color accent
   
   Card.tsx:
   - Props: children, title, className
   - Background blanco, shadow, rounded
   - Título opcional en el header
   
   Modal.tsx:
   - Props: isOpen, onClose, title, children, size
   - Backdrop oscuro
   - Animación de entrada/salida
   - Botón X para cerrar
   - Cierra con ESC
   - Previene scroll del body cuando está abierto
   
   Select.tsx:
   - Props: label, options, value, onChange, error, placeholder
   - Dropdown estilizado
   - Muestra error debajo

5. Router principal (src/App.tsx):
   - React Router v6
   - Rutas protegidas que verifican autenticación
   - Rutas públicas: /login
   - Rutas privadas: /branch-selection, /dashboard, /products, /sales, /drops, /stock, /cash, /reports
   - Redirect a /login si no autenticado
   - Redirect a /branch-selection si no hay sucursal activa

Dame el código completo de todos estos componentes con TypeScript estricto.
```

---

## 5️⃣ GESTIÓN DE PRODUCTOS

```
Implementa el sistema completo de gestión de productos:

1. Servicio de productos (src/services/productService.ts):
   - getProducts(filters?: { category?, search?, includeHidden? })
   - getProductById(id)
   - createProduct(product)
   - updateProduct(id, updates)
   - deleteProduct(id)
   - uploadProductImage(file) - sube a Supabase Storage
   - deleteProductImage(url)
   - getProductWithVariants(id) - incluye variantes
   - createProductVariant(productId, size)
   - deleteProductVariant(variantId)
   - toggleProductVisibility(productId)
   - Manejo de errores

2. Página de productos (src/pages/ProductsPage.tsx):
   - Header con:
     * Título "Productos"
     * Buscador con debounce
     * Filtro por categoría
     * Toggle "Mostrar ocultos"
     * Botón "Nuevo Producto"
   - Grid de ProductCard
   - Estados: loading, error, empty
   - Paginación o infinite scroll

3. Card de producto (src/components/products/ProductCard.tsx):
   - Props: product, onEdit, onDelete, onToggleVisibility
   - Muestra:
     * Imagen (placeholder si no tiene)
     * Nombre
     * Categoría
     * Precio
     * Número de variantes
     * Badge si está oculto
   - Botones:
     * Editar (icono Pencil)
     * Eliminar (icono Trash2) - con confirmación
     * Ocultar/Mostrar (icono Eye/EyeOff)
   - Hover effects

4. Formulario de producto (src/components/products/ProductForm.tsx):
   - Modal o página separada
   - Campos:
     * Nombre (required)
     * Descripción (textarea)
     * Categoría (select)
     * Precio (number, min 0)
     * Imagen (file upload con preview)
     * Tallas (multi-select con chips)
   - Validación en tiempo real
   - Botones: Guardar, Cancelar
   - Loading state al guardar
   - Preview de imagen antes de subir
   - Permite editar producto existente

5. Hook useDebounce (src/hooks/useDebounce.ts):
   - Hook genérico para debounce
   - Delay configurable (default 500ms)

Dame el código completo con validaciones y manejo de errores.
```

---

## 6️⃣ SISTEMA DE VENTAS CON CARRITO

```
Implementa el sistema completo de ventas:

1. Store del carrito (src/store/cartStore.ts):
   - Estado: items[], total, subtotal, discount
   - Item: { variantId, productName, size, price, quantity, available }
   - Acciones:
     * addItem(variant, product, quantity)
     * removeItem(variantId)
     * updateQuantity(variantId, quantity)
     * setDiscount(amount)
     * clearCart()
     * calculateTotals()
   - Validar stock disponible antes de agregar

2. Servicio de ventas (src/services/salesService.ts):
   - createSale(saleData)
   - getSales(branchId, filters?)
   - getSaleById(id)
   - getSalesByDate(branchId, date)
   - getDailySales(branchId)
   - Actualiza stock automáticamente
   - Registra movimiento en caja
   - Usa transacciones si es posible

3. Página de ventas (src/pages/SalesPage.tsx):
   Layout en 2 columnas:
   
   Columna izquierda (Productos):
   - Buscador de productos
   - Filtro por categoría
   - Grid de productos disponibles
   - Al hacer click: muestra modal de selección de talla
   
   Columna derecha (Carrito):
   - Lista de items agregados
   - Cada item muestra:
     * Nombre del producto
     * Talla
     * Precio unitario
     * Input para cantidad (con +/-)
     * Botón eliminar
   - Resumen:
     * Subtotal
     * Input de descuento
     * Total
   - Botón "Pagar" (abre modal de pago)

4. Modal de selección de talla (src/components/sales/SizeSelectionModal.tsx):
   - Props: product, onSelect, onClose
   - Muestra tallas disponibles con stock
   - Tallas sin stock deshabilitadas
   - Input de cantidad
   - Botón "Agregar al carrito"

5. Modal de pago (src/components/sales/PaymentModal.tsx):
   - Muestra total a pagar
   - Tabs para método de pago:
     * EFECTIVO: input de monto recibido, calcula cambio
     * QR: solo confirmar
     * TARJETA: solo confirmar
     * MIXTO: inputs para cada método, valida que sumen el total
   - Botón "Confirmar venta"
   - Loading state
   - Cierra y muestra comprobante al terminar

6. Comprobante de venta (src/components/sales/SaleReceipt.tsx):
   - Modal con resumen de venta:
     * Número de venta
     * Fecha y hora
     * Vendedor
     * Lista de productos
     * Subtotal, descuento, total
     * Método de pago
   - Botones:
     * Imprimir (window.print)
     * Nueva venta (limpia carrito)
     * Cerrar

Dame el código completo con validaciones robustas de stock y pagos.
```

---

## 7️⃣ CONTROL DE INVENTARIO (STOCK)

```
Implementa el sistema de control de stock:

1. Servicio de stock (src/services/stockService.ts):
   - getStockByBranch(branchId)
   - getStockByProduct(productId, branchId)
   - getStockByVariant(variantId, branchId)
   - updateStock(variantId, branchId, quantity)
   - transferStock(variantId, fromBranchId, toBranchId, quantity)
   - getStockHistory(variantId, branchId)
   - getLowStock(branchId, threshold = 5)
   - Validar que quantity >= 0

2. Página de stock (src/pages/StockPage.tsx):
   - Filtros:
     * Búsqueda por producto
     * Filtro por categoría
     * Filtro "Stock bajo" (< 5 unidades)
   - Tabla con columnas:
     * Producto (con imagen)
     * Talla
     * Cantidad actual
     * Acciones (Ajustar, Transferir)
   - Badge rojo si stock < 5
   - Paginación
   - Loading skeleton

3. Modal de ajuste de stock (src/components/stock/AdjustStockModal.tsx):
   - Props: variant, currentStock, onSave, onClose
   - Muestra:
     * Nombre del producto
     * Talla
     * Stock actual
     * Input de nueva cantidad
     * Razón del ajuste (select: Compra, Devolución, Corrección, Daño)
     * Notas (textarea opcional)
   - Validar que cantidad >= 0
   - Botones: Guardar, Cancelar

4. Modal de transferencia (src/components/stock/TransferStockModal.tsx):
   - Props: variant, fromBranch, onTransfer, onClose
   - Campos:
     * Producto y talla (readonly)
     * Sucursal destino (select)
     * Cantidad a transferir (max = stock actual)
     * Notas
   - Validaciones:
     * No transferir a la misma sucursal
     * No transferir más del disponible
     * Cantidad > 0
   - Actualiza stock en ambas sucursales

5. Componente de alerta de stock bajo (src/components/stock/LowStockAlert.tsx):
   - Badge o notificación
   - Muestra número de productos con stock bajo
   - Link a la página de stock con filtro activo
   - Aparece en header o sidebar

Dame el código completo con validaciones y manejo de errores.
```

---

## 8️⃣ SISTEMA DE DROPS/COLECCIONES

```
Implementa el sistema de lanzamientos (drops):

1. Servicio de drops (src/services/dropService.ts):
   - getDrops(filters?: { status? })
   - getActiveDrops() - usa función de Supabase
   - getDropById(id)
   - getDropWithProducts(id) - usa función de Supabase
   - createDrop(dropData)
   - updateDrop(id, updates)
   - deleteDrop(id)
   - addProductToDrop(dropId, productId, isFeatured?, sortOrder?)
   - removeProductFromDrop(dropId, productId)
   - updateDropProduct(dropProductId, updates)
   - uploadDropImage(file, type: 'image' | 'banner')

2. Página de drops (src/pages/DropsPage.tsx):
   - Tabs:
     * Activos
     * Inactivos
     * Finalizados
     * Todos
   - Grid de DropCard
   - Botón "Nuevo Drop"
   - Filtros y búsqueda

3. Card de drop (src/components/drops/DropCard.tsx):
   - Props: drop, onEdit, onDelete, onManageProducts
   - Muestra:
     * Banner o imagen
     * Nombre
     * Descripción (truncada)
     * Fechas de inicio/fin
     * Badge de estado
     * Badge "Destacado" si is_featured
     * Número de productos
   - Botones:
     * Editar
     * Gestionar productos
     * Eliminar (con confirmación)

4. Formulario de drop (src/components/drops/DropForm.tsx):
   - Campos:
     * Nombre (required)
     * Descripción (textarea)
     * Fecha de lanzamiento (datetime-local)
     * Fecha de fin (datetime-local, opcional)
     * Estado (select: ACTIVO, INACTIVO, FINALIZADO)
     * Destacado (checkbox)
     * Imagen principal (file upload)
     * Banner (file upload)
   - Preview de imágenes
   - Validación: fecha de fin > fecha de inicio

5. Gestor de productos del drop (src/components/drops/DropProductManager.tsx):
   - Props: dropId
   - 2 columnas:
     
     Izquierda (Productos disponibles):
     - Lista de todos los productos
     - Buscador
     - Botón "Agregar" en cada producto
     
     Derecha (Productos en el drop):
     - Lista ordenable (drag & drop opcional)
     - Cada item:
       * Producto
       * Checkbox "Destacado"
       * Input de orden
       * Botón "Quitar"
     - Botón "Guardar cambios"

Dame el código completo con drag & drop si es posible.
```

---

## 9️⃣ CONTROL DE CAJA

```
Implementa el sistema completo de control de caja:

1. Servicio de caja (src/services/cashService.ts):
   - getOpenCashRegister(branchId) - usa función RPC
   - openCashRegister(branchId, openingAmount, notes?) - usa función RPC
   - closeCashRegister(cashRegisterId, closingAmount, notes?) - usa función RPC
   - getCashRegisterSummary(cashRegisterId) - usa función RPC
   - getCashMovements(cashRegisterId)
   - addCashMovement(movement)
   - getCashRegisterHistory(branchId, filters?)

2. Página de caja (src/pages/CashPage.tsx):
   - Verifica si hay caja abierta
   
   Si NO hay caja abierta:
   - Card centrado "No hay caja abierta"
   - Botón "Abrir Caja"
   
   Si SÍ hay caja abierta:
   - Header con:
     * Título "Caja Abierta"
     * Fecha/hora de apertura
     * Usuario que abrió
     * Fondo inicial
   - Cards de resumen en tiempo real:
     * Total en efectivo
     * Total en QR
     * Total en tarjeta
     * Total general
     * Número de ventas
   - Tabla de movimientos del día
   - Botones:
     * Agregar movimiento manual
     * Cerrar caja

3. Modal de apertura (src/components/cash/OpenCashModal.tsx):
   - Input de fondo inicial (required, min 0)
   - Textarea de notas (opcional)
   - Botones: Abrir, Cancelar
   - Valida que no haya otra caja abierta
   - Loading state

4. Modal de cierre (src/components/cash/CloseCashModal.tsx):
   - Muestra resumen completo:
     * Fondo inicial
     * Total de ventas
     * Desglose por método de pago:
       - Efectivo esperado
       - QR esperado
       - Tarjeta esperado
     * Total esperado
   - Input de monto real en efectivo
   - Calcula diferencia (faltante/sobrante)
   - Muestra diferencia en rojo si falta, verde si sobra
   - Textarea de notas de cierre
   - Confirmación: "¿Estás seguro de cerrar la caja?"
   - Botones: Cerrar Caja, Cancelar

5. Modal de movimiento manual (src/components/cash/ManualMovementModal.tsx):
   - Radio buttons: Ingreso / Egreso
   - Select de tipo de pago
   - Input de monto
   - Input de descripción
   - Botones: Guardar, Cancelar

6. Tabla de movimientos (src/components/cash/CashMovementsTable.tsx):
   - Columnas:
     * Hora
     * Tipo (Ingreso/Egreso con badge)
     * Método de pago
     * Monto
     * Descripción
     * Usuario
   - Totales al pie
   - Colores: verde para ingresos, rojo para egresos

Dame el código completo con validaciones estrictas.
```

---

## 🔟 DASHBOARD Y REPORTES

```
Implementa el dashboard y sistema de reportes:

1. Servicio de reportes (src/services/reportService.ts):
   - getDashboardStats(branchId, startDate, endDate) - usa función RPC
   - getSalesByPaymentMethod(branchId, startDate, endDate)
   - getTopProducts(branchId, startDate, endDate, limit = 5)
   - getSalesChart(branchId, startDate, endDate) - por día
   - getRevenueTrend(branchId, days = 7)
   - getMixedPaymentBreakdown(branchId, date) - usa función RPC
   - getSalesWithDiscounts(branchId, date) - usa función RPC
   - exportSalesReport(branchId, startDate, endDate) - genera CSV

2. Página de Dashboard (src/pages/DashboardPage.tsx):
   - Filtros:
     * Selector de rango de fechas (Hoy, 7 días, 30 días, Personalizado)
     * Si es admin: selector de sucursal
   
   - Cards de métricas principales:
     * Ventas totales (número grande)
     * Número de transacciones
     * Ticket promedio
     * Productos vendidos
   
   - Gráfico de ventas de los últimos 7 días (área o líneas)
   
   - 2 columnas:
     Izquierda:
     - Top 5 productos más vendidos (lista con cantidades)
     
     Derecha:
     - Desglose por método de pago (gráfico de dona o barras)
   
   - Auto-refresh cada 30 segundos

3. Página de Reportes (src/pages/ReportsPage.tsx):
   - Filtros avanzados:
     * Rango de fechas personalizado
     * Sucursal (admin)
     * Tipo de reporte:
       - Ventas por período
       - Ventas por producto
       - Ventas por vendedor
       - Pagos mixtos
       - Descuentos aplicados
       - Movimientos de stock
       - Histórico de cajas
   
   - Tabla de resultados según tipo seleccionado
   
   - Botones:
     * Exportar a CSV
     * Exportar a PDF (opcional)
     * Imprimir

4. Componentes de gráficos (src/components/reports/):
   
   SalesChart.tsx:
   - Gráfico de líneas/área con Recharts
   - Muestra ventas por día
   - Tooltips informativos
   
   PaymentMethodChart.tsx:
   - Gráfico de dona con Recharts
   - Muestra distribución de métodos de pago
   - Leyenda con porcentajes
   
   TopProductsChart.tsx:
   - Gráfico de barras horizontales
   - Top productos por cantidad o monto
   - Colores vibrantes

5. Utilidad de exportación (src/utils/exportUtils.ts):
   - exportToCSV(data, filename)
   - exportToPDF(data, filename) - opcional con jsPDF
   - formatCurrency(amount)
   - formatDate(date)

Dame el código completo con gráficos funcionales usando Recharts.
```

---

## 1️⃣1️⃣ COMPONENTES UI AVANZADOS

```
Crea componentes UI reutilizables adicionales:

1. Toast notifications (src/components/ui/Toast.tsx):
   - Usa react-hot-toast
   - Wrapper personalizado con estilos de Outsiders
   - Funciones helper:
     * toast.success(message)
     * toast.error(message)
     * toast.loading(message)
     * toast.promise(promise, messages)
   - Posición: top-right
   - Duración: 3 segundos

2. Loading Spinner (src/components/ui/Spinner.tsx):
   - Props: size ('sm' | 'md' | 'lg'), color
   - Animación de rotación suave
   - SVG o CSS

3. Empty State (src/components/ui/EmptyState.tsx):
   - Props: icon, title, description, action?
   - Diseño centrado
   - Icono grande en gris claro
   - Botón de acción opcional

4. Confirmation Dialog (src/components/ui/ConfirmDialog.tsx):
   - Props: isOpen, title, message, onConfirm, onCancel, variant
   - Variantes: 'danger' (rojo), 'warning' (amarillo), 'info' (azul)
   - Botones: Confirmar, Cancelar
   - Cierra con ESC

5. Badge (src/components/ui/Badge.tsx):
   - Props: children, variant, size
   - Variantes: primary, secondary, success, danger, warning
   - Tamaños: sm, md, lg
   - Redondeado completo

6. Skeleton (src/components/ui/Skeleton.tsx):
   - Props: width, height, variant
   - Animación de shimmer
   - Variantes: text, circle, rect
   - Para estados de loading

7. Pagination (src/components/ui/Pagination.tsx):
   - Props: currentPage, totalPages, onPageChange
   - Botones: Primera, Anterior, Números, Siguiente, Última
   - Página actual destacada
   - Ellipsis cuando hay muchas páginas

8. DateRangePicker (src/components/ui/DateRangePicker.tsx):
   - Props: startDate, endDate, onChange
   - Shortcuts: Hoy, 7 días, 30 días, Este mes
   - Calendarios para selección manual
   - Valida que endDate >= startDate

Dame el código completo de todos estos componentes con TypeScript.
```

---

## 1️⃣2️⃣ OPTIMIZACIONES Y MEJORAS

```
Implementa optimizaciones y mejoras de rendimiento:

1. Lazy loading de rutas:
   - Usa React.lazy y Suspense
   - Lazy load para: ProductsPage, SalesPage, DropsPage, StockPage, ReportsPage
   - Fallback con Spinner

2. React Query para caché (alternativa a estado manual):
   - Instala @tanstack/react-query
   - Configura QueryClientProvider
   - Hooks personalizados:
     * useProducts()
     * useSales()
     * useDrops()
     * useStock()
     * useCashRegister()
   - Stale time: 5 minutos
   - Cache time: 10 minutos

3. Optimización de imágenes:
   - Componente Image.tsx con lazy loading
   - Placeholder blur mientras carga
   - Compresión antes de subir a Supabase
   - Múltiples resoluciones si es posible

4. Virtual scrolling para listas largas:
   - Usa react-window o react-virtualized
   - Implementa en ProductList, StockTable, SalesList

5. Service Worker para PWA (opcional):
   - Configura Workbox
   - Cache de assets estáticos
   - Estrategia de red first para API
   - Manifest.json para instalación

6. Error Boundary:
   - Componente ErrorBoundary.tsx
   - Captura errores de React
   - Muestra UI de error amigable
   - Botón para recargar
   - Log de errores

7. Validación con Zod:
   - Instala zod
   - Schemas de validación para:
     * ProductSchema
     * SaleSchema
     * DropSchema
     * CashRegisterSchema
   - Usar en formularios

8. Keyboard shortcuts:
   - useKeyboardShortcut hook
   - Shortcuts útiles:
     * Ctrl+K: Abrir búsqueda global
     * Ctrl+N: Nueva venta (en página de ventas)
     * Ctrl+S: Guardar (en formularios)
     * ESC: Cerrar modales

Dame el código de estas optimizaciones.
```

---

## 1️⃣3️⃣ TESTING Y DOCUMENTACIÓN

```
Configura testing y documentación del proyecto:

1. Vitest para unit tests:
   - Instala vitest, @testing-library/react
   - Configura vitest.config.ts
   - Tests para:
     * Stores (authStore, cartStore)
     * Servicios (productService, salesService)
     * Utilidades (exportUtils, formatters)
   - Mocks de Supabase

2. Tests de componentes:
   - ProductCard.test.tsx
   - Button.test.tsx
   - Modal.test.tsx
   - SalesForm.test.tsx

3. E2E tests con Playwright (opcional):
   - Flujo de venta completo
   - Login y navegación
   - CRUD de productos

4. Documentación (README.md):
   - Descripción del proyecto
   - Tecnologías usadas
   - Estructura de carpetas
   - Instalación y configuración
   - Variables de entorno
   - Scripts disponibles
   - Guía de desarrollo
   - Arquitectura del sistema
   - Diagrama de base de datos

5. Documentación de componentes:
   - JSDoc en todos los componentes principales
   - Props documentadas
   - Ejemplos de uso

6. CHANGELOG.md:
   - Registro de cambios por versión
   - Formato: Keep a Changelog

Dame la configuración de testing y el README completo.
```

---

## 🎯 BONUS: CARACTERÍSTICAS AVANZADAS

```
Implementa características avanzadas opcionales:

1. Búsqueda global (Command Palette):
   - Componente CommandPalette.tsx
   - Hotkey: Ctrl+K
   - Búsqueda fuzzy de:
     * Productos
     * Ventas
     * Comandos (Nueva venta, Abrir caja, etc.)
   - Navegación rápida
   - Usa @headlessui/react

2. Notificaciones en tiempo real:
   - Escucha cambios de Supabase Realtime
   - Notifica cuando:
     * Nueva venta (si eres admin)
     * Stock bajo
     * Nueva caja abierta
   - Toast notifications

3. Modo oscuro:
   - Toggle en header
   - Guarda preferencia en localStorage
   - Context o store para tema
   - Paleta de colores dark
   - Transition suave

4. Multi-idioma (i18n):
   - Usa react-i18next
   - Idiomas: Español, Inglés
   - Archivos de traducción en /locales
   - Selector de idioma en header

5. Exportación a PDF:
   - Instala jspdf, jspdf-autotable
   - Generar PDF para:
     * Comprobante de venta
     * Reporte de ventas
     * Cierre de caja
     * Inventario
   - Logo de Outsiders en header

6. Gráficos avanzados:
   - Gráfico de embudo de ventas
   - Mapa de calor de ventas por hora
   - Gráfico de tendencias comparativas
   - Predicciones con regresión lineal simple

7. Gestión de usuarios (para admin):
   - CRUD de usuarios
   - Asignar/cambiar sucursal
   - Cambiar roles
   - Resetear contraseñas
   - Historial de actividad

8. Sistema de permisos granular:
   - Define permisos específicos
   - No solo admin/vendedor
   - Permisos por módulo
   - Componente CanAccess para condicionales

Dame el código de las características que elijas implementar.
```

---

## ✅ CHECKLIST FINAL

```
Verifica que el proyecto tenga:

CONFIGURACIÓN:
[ ] Vite configurado correctamente
[ ] TypeScript estricto
[ ] Tailwind CSS funcionando
[ ] Variables de entorno configuradas
[ ] Supabase conectado

AUTENTICACIÓN:
[ ] Login funcional
[ ] Logout funcional
[ ] Selección de sucursal
[ ] Protección de rutas
[ ] Persistencia de sesión

FUNCIONALIDADES CORE:
[ ] CRUD de productos completo
[ ] Sistema de ventas con carrito
[ ] Control de stock
[ ] Apertura/cierre de caja
[ ] Gestión de drops
[ ] Dashboard con estadísticas
[ ] Reportes exportables

UI/UX:
[ ] Responsive en mobile y desktop
[ ] Loading states en todas las acciones
[ ] Mensajes de error claros
[ ] Confirmaciones antes de eliminar
[ ] Toasts informativos
[ ] Animaciones suaves

VALIDACIONES:
[ ] No vender sin stock
[ ] No cerrar caja con pendientes
[ ] Validar montos positivos
[ ] Validar pagos mixtos sumen correcto
[ ] Validar fechas lógicas

OPTIMIZACIONES:
[ ] Lazy loading de rutas
[ ] Debounce en búsquedas
[ ] Imágenes optimizadas
[ ] Caché de datos
[ ] Code splitting

TESTING:
[ ] Tests unitarios de stores
[ ] Tests de servicios
[ ] Tests de componentes críticos
[ ] README completo

DEPLOYMENT:
[ ] Build sin errores
[ ] .env.example creado
[ ] .gitignore configurado
[ ] Scripts en package.json

SEGURIDAD:
[ ] RLS configurado en Supabase
[ ] Validaciones server-side
[ ] Autenticación segura
[ ] No exponer secrets

Genera un script que verifique todos estos puntos.
```

---

**🚀 CON ESTOS PROMPTS PUEDES CONSTRUIR EL ERP COMPLETO PASO A PASO**

Usa cada prompt en orden para ir construyendo el proyecto de forma modular y organizada.

# 🚀 PROMPT COMPLETO PARA BOLT.NEW - OUTSIDERS ERP

Copia este prompt completo en **bolt.new** para generar todo el ERP automáticamente.

---

## 💬 PROMPT PARA BOLT

```
Crea un ERP completo para tienda de ropa "OUTSIDERS" con React + TypeScript + Vite + Supabase + Tailwind CSS.

STACK TECNOLÓGICO:
- Frontend: React 18 + TypeScript
- Build: Vite
- Styling: Tailwind CSS
- Backend: Supabase (PostgreSQL + Auth + Storage)
- Estado: Zustand
- Router: React Router v6
- Iconos: Lucide React
- Gráficos: Recharts
- Notificaciones: react-hot-toast

FUNCIONALIDADES PRINCIPALES:

1. AUTENTICACIÓN
- Login con email/password (Supabase Auth)
- Roles: admin (acceso total) y vendedor (solo su sucursal)
- Selección de sucursal después del login
- Persistencia de sesión

2. SISTEMA DE VENTAS (PRINCIPAL)
- Carrito de compras inteligente
- Búsqueda de productos con debounce
- Selección de tallas según stock disponible
- Descuentos por venta
- Pagos: EFECTIVO (con cálculo de cambio), QR, TARJETA, MIXTO
- Para pagos mixtos: inputs separados que validen que sumen el total
- Actualización automática de stock
- Registro automático en caja
- Comprobante de venta imprimible

3. GESTIÓN DE PRODUCTOS
- CRUD completo
- Upload de imágenes a Supabase Storage
- Categorías: Remeras, Pantalones, Buzos, Accesorios, Zapatillas
- Variantes por talla: XS, S, M, L, XL, XXL
- Precio único por producto (no por variante)
- Búsqueda y filtros
- Ocultar/mostrar productos

4. CONTROL DE INVENTARIO
- Stock por variante y sucursal
- Actualización manual de stock
- Transferencias entre sucursales
- Alertas de stock bajo (< 5 unidades)
- Badge rojo en productos con stock bajo

5. SISTEMA DE CAJA
- Apertura con fondo inicial
- Solo una caja abierta por sucursal
- Registro automático de ventas
- Movimientos manuales (ingresos/egresos)
- Cierre con desglose completo:
  * Efectivo esperado vs real
  * Diferencia (faltante/sobrante) en rojo o verde
  * QR total
  * Tarjeta total
- Historial de cajas cerradas

6. DROPS/LANZAMIENTOS
- Crear colecciones especiales
- Asignar productos a drops
- Destacar drops
- Estados: ACTIVO, INACTIVO, FINALIZADO
- Fechas de inicio y fin

7. DASHBOARD
- Ventas del día/semana/mes
- Número de transacciones
- Ticket promedio
- Productos vendidos
- Gráfico de ventas de últimos 7 días (área)
- Top 5 productos más vendidos
- Desglose por método de pago (dona)

8. REPORTES
- Ventas por período
- Ventas por producto
- Pagos mixtos
- Descuentos aplicados
- Exportar a CSV

ESTRUCTURA DE DATOS (SUPABASE):

Tablas:
- branches: id, name, address, created_at
- users: id, name, email, role, branch_id, created_at
- products: id, name, description, category, price, image_url, drop_id, is_visible, created_at
- product_variants: id, product_id, size, created_at
- stock: id, variant_id, branch_id, quantity, created_at, updated_at
- sales: id, user_id, branch_id, subtotal, discount_amount, total, payment_type, payment_details (jsonb), sale_date, created_at
- sale_items: id, sale_id, variant_id, quantity, unit_price, subtotal
- drops: id, name, description, launch_date, end_date, status, is_featured, image_url, banner_url, created_at, updated_at
- drop_products: id, drop_id, product_id, is_featured, sort_order, created_at
- cash_registers: id, branch_id, user_id, status, opening_date, opening_amount, opening_user_id, opening_notes, closing_date, closing_amount, closing_user_id, closing_notes, expected_cash, expected_qr, expected_card, expected_total, cash_difference, created_at, updated_at
- cash_movements: id, cash_register_id, movement_type, payment_type, amount, description, reference_id, reference_type, user_id, created_at

LAYOUT:
- Header: Logo "OUTSIDERS" | Sucursal activa | Menú de usuario
- Sidebar: Dashboard, Ventas, Productos, Drops, Stock, Caja, Reportes
- Responsive: sidebar oculto en mobile con hamburguesa
- Colores: Negro (#000000), Blanco (#FFFFFF), Accent (#FF6B35)
- Fuente: Inter

COMPONENTES UI NECESARIOS:
- Button (variantes: primary, secondary, danger)
- Input (con validación y error)
- Card
- Modal (con backdrop y ESC para cerrar)
- Select
- Badge (variantes con colores)
- Toast notifications
- Spinner de carga
- EmptyState
- ConfirmDialog

VALIDACIONES CRÍTICAS:
✓ No vender sin stock disponible
✓ No cerrar caja si hay ventas sin registrar
✓ Validar que montos sean >= 0
✓ En pagos mixtos: efectivo + qr + tarjeta = total
✓ No permitir eliminar productos con stock > 0
✓ Solo una caja abierta por sucursal
✓ Validar fechas lógicas (fin > inicio)

PÁGINA DE VENTAS (MÁS IMPORTANTE):
Layout 2 columnas:

Izquierda:
- Buscador de productos (con debounce 500ms)
- Filtro por categoría
- Grid 3 columnas de productos
- Click en producto → Modal de selección de talla

Derecha (Carrito):
- Lista de items con:
  * Nombre + Talla
  * Precio unitario
  * Input cantidad (+/-)
  * Botón eliminar
- Subtotal
- Input descuento (opcional)
- Total grande
- Botón "Pagar"

Modal de Pago (tabs):
1. EFECTIVO: input monto recibido → muestra cambio
2. QR: solo botón confirmar
3. TARJETA: solo botón confirmar
4. MIXTO: 3 inputs (efectivo, qr, tarjeta) con validación de suma

Al confirmar:
1. Actualiza stock
2. Registra en cash_movements
3. Limpia carrito
4. Muestra comprobante

PÁGINA DE CAJA:
Si NO hay caja abierta:
- Botón grande "Abrir Caja"
- Modal: input fondo inicial + notas

Si SÍ hay caja abierta:
- 4 Cards: Total efectivo, Total QR, Total tarjeta, Total general
- Tabla de movimientos del día
- Botón "Cerrar Caja"

Modal de Cierre:
- Resumen:
  * Fondo inicial: $XXX
  * Efectivo esperado: $XXX
  * Input: Efectivo real: $___
  * Diferencia: $XXX (rojo si falta, verde si sobra)
  * QR total: $XXX
  * Tarjeta total: $XXX
- Textarea notas de cierre
- Confirmación antes de cerrar

CONFIGURACIÓN SUPABASE:
Variables de entorno:
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY

Storage bucket: 'products' (público para imágenes)

RLS habilitado en todas las tablas

ESTADOS DE CARGA:
✓ Mostrar spinner en botones durante acciones
✓ Skeleton loaders en listas
✓ Toast de éxito/error en todas las acciones
✓ Loading state en formularios

OPTIMIZACIONES:
- Lazy loading de rutas
- Debounce en búsquedas
- React.memo en componentes pesados
- Caché de productos en memoria

FLUJO DE USUARIO TÍPICO:
1. Login → Selecciona sucursal
2. Va a "Ventas"
3. Busca productos, agrega al carrito
4. Aplica descuento si necesita
5. Click "Pagar"
6. Selecciona método de pago
7. Confirma venta
8. Ve comprobante
9. Nueva venta

PRIORIDADES DE IMPLEMENTACIÓN:
1. Autenticación y layout
2. Sistema de ventas completo (carrito + pagos)
3. Gestión de productos
4. Control de caja
5. Stock
6. Dashboard
7. Drops
8. Reportes

IMPORTANTE:
- Todo en español
- Responsive mobile-first
- Validaciones robustas
- Manejo de errores con try/catch
- Toast informativos
- Confirmaciones antes de eliminar
- No exponer secrets en código

Genera el proyecto completo con todos los archivos necesarios, configuración de Supabase, componentes, páginas, servicios, stores, y tipos TypeScript.
```

---

## 🎯 INSTRUCCIONES PARA USAR EN BOLT

1. Ve a **https://bolt.new**
2. **Copia TODO el prompt de arriba** (desde "Crea un ERP completo..." hasta el final)
3. **Pégalo en el chat de Bolt**
4. Presiona **Enter**
5. ⏱️ **Espera** a que Bolt genere todo el proyecto (puede tomar 2-5 minutos)
6. Bolt creará:
   - ✅ Estructura de carpetas completa
   - ✅ Todos los componentes
   - ✅ Configuración de Tailwind
   - ✅ package.json con dependencias
   - ✅ Tipos TypeScript
   - ✅ Servicios de Supabase
   - ✅ Stores de Zustand
   - ✅ Rutas protegidas
   - ✅ UI completa

7. **Después que termine**, copia este SQL en Supabase:
   - Ve al archivo `supabase/migrations/20251214_outsiders_complete_schema.sql`
   - Copia todo el contenido
   - Pégalo en el SQL Editor de Supabase
   - Ejecuta

8. **Configura las variables de entorno**:
   - En Bolt, busca el archivo `.env` o `.env.example`
   - Agrega tu `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`

9. **¡Listo!** Tu ERP estará funcionando

---

## 📝 PROMPTS ADICIONALES PARA BOLT (Si necesitas ajustes)

### Si falta algo:
```
Agrega [funcionalidad específica] al proyecto. Ejemplo:
"Agrega validación para que no se pueda cerrar la caja si hay stock negativo"
```

### Si hay errores:
```
Hay un error en [archivo/componente]. El error es: [descripción del error].
Corrige el código.
```

### Si quieres cambiar diseño:
```
Cambia el diseño de [componente/página] para que:
- [característica 1]
- [característica 2]
```

### Si quieres agregar features:
```
Agrega estas características adicionales:
1. Modo oscuro con toggle en el header
2. Exportación de reportes a PDF
3. Notificaciones en tiempo real cuando hay ventas
```

---

## 🎨 PERSONALIZACIÓN DE MARCA

Si quieres cambiar colores después:
```
Cambia la paleta de colores a:
- Primary: [color]
- Secondary: [color]
- Accent: [color]

Actualiza todos los componentes con estos nuevos colores.
```

---

## ⚡ VENTAJAS DE USAR BOLT

✅ **Genera todo el proyecto en minutos** (no horas)  
✅ **Ya viene con hot reload** funcionando  
✅ **Instala dependencias automáticamente**  
✅ **Preview en tiempo real** mientras genera  
✅ **Puede hacer cambios iterativos** fácilmente  
✅ **Exporta el código** para seguir trabajando local  

---

## 🚨 IMPORTANTE DESPUÉS DE GENERAR

1. **Revisa el código generado** - asegúrate que tenga sentido
2. **Prueba cada funcionalidad** - ventas, productos, caja, etc.
3. **Ajusta validaciones** si hace falta
4. **Personaliza diseños** según tu gusto
5. **Agrega tu logo** en lugar del texto "OUTSIDERS"
6. **Configura Supabase Storage** para las imágenes
7. **Crea usuarios de prueba** en Supabase Auth

---

## 🎯 CHECKLIST POST-GENERACIÓN

```
[ ] El login funciona
[ ] Puedo seleccionar sucursal
[ ] Puedo crear productos con imágenes
[ ] Puedo agregar productos al carrito
[ ] Los pagos validan correctamente
[ ] El stock se descuenta al vender
[ ] Puedo abrir caja
[ ] Las ventas se registran en caja
[ ] Puedo cerrar caja con resumen
[ ] El dashboard muestra estadísticas
[ ] Los gráficos funcionan
[ ] Puedo crear drops
[ ] Los reportes se exportan
[ ] Todo es responsive
```

---

## 💡 TIP PRO

Después que Bolt genere el proyecto, puedes pedirle mejoras específicas:

```
"Mejora el componente de ventas para que:
- Muestre una imagen pequeña de cada producto en el carrito
- Permita buscar productos por código de barras
- Guarde el carrito en localStorage si el usuario sale sin pagar"
```

Bolt iterará sobre el código y hará los cambios. 🚀

---

**¡LISTO! Copia el prompt principal en Bolt y en minutos tendrás tu ERP funcionando.**

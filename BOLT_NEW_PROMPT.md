# 🚀 Prompt para Bolt.new - Sistema de Flujo de Caja con Supabase

## 📋 Descripción General

Necesito que crees un sistema completo de flujo de caja para una tienda de ropa usando **Supabase** como backend. El sistema debe manejar apertura/cierre de caja, movimientos manuales, ventas automáticas y reportes detallados.

## 🏗️ Arquitectura del Sistema

### Frontend
- **React + TypeScript** con Vite
- **Tailwind CSS** para estilos
- **React Router** para navegación
- **Zustand** para manejo de estado
- **Lucide React** para iconos

### Backend
- **Supabase** (PostgreSQL + Auth + Real-time)
- **Funciones SQL personalizadas** para lógica de negocio
- **Triggers automáticos** para cálculos
- **Sin políticas RLS** (Row Level Security)

## 🗄️ Estructura de Base de Datos

### 1. Tabla `users`
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'vendedor')),
  branch_id UUID REFERENCES branches(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 2. Tabla `branches` (Sucursales)
```sql
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 3. Tabla `cash_registers` (Cajas Registradoras)
```sql
CREATE TABLE cash_registers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  user_id UUID NOT NULL REFERENCES users(id),
  status VARCHAR(50) NOT NULL DEFAULT 'ABIERTA' CHECK (status IN ('ABIERTA', 'CERRADA')),
  opening_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  opening_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  opening_user_id UUID NOT NULL REFERENCES users(id),
  opening_notes TEXT,
  closing_date TIMESTAMP WITH TIME ZONE,
  closing_amount DECIMAL(10,2),
  closing_user_id UUID REFERENCES users(id),
  closing_notes TEXT,
  expected_cash DECIMAL(10,2) NOT NULL DEFAULT 0,
  expected_qr DECIMAL(10,2) NOT NULL DEFAULT 0,
  expected_card DECIMAL(10,2) NOT NULL DEFAULT 0,
  expected_total DECIMAL(10,2) NOT NULL DEFAULT 0,
  cash_difference DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 4. Tabla `cash_movements` (Movimientos de Caja)
```sql
CREATE TABLE cash_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_register_id UUID NOT NULL REFERENCES cash_registers(id),
  user_id UUID NOT NULL REFERENCES users(id),
  movement_type VARCHAR(50) NOT NULL CHECK (movement_type IN ('INGRESO', 'EGRESO')),
  payment_type VARCHAR(50) NOT NULL CHECK (payment_type IN ('EFECTIVO', 'QR', 'TARJETA', 'MIXTO')),
  amount DECIMAL(10,2) NOT NULL,
  description TEXT NOT NULL,
  reference_id UUID,
  reference_type VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 5. Tabla `products` (Productos)
```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  price DECIMAL(10,2) NOT NULL,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 6. Tabla `product_variants` (Variantes de Productos)
```sql
CREATE TABLE product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  size VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 7. Tabla `stock` (Inventario)
```sql
CREATE TABLE stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID NOT NULL REFERENCES product_variants(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(variant_id, branch_id)
);
```

### 8. Tabla `sales` (Ventas)
```sql
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  payment_type VARCHAR(50) NOT NULL CHECK (payment_type IN ('EFECTIVO', 'QR', 'TARJETA', 'MIXTO')),
  total DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2),
  discount_amount DECIMAL(10,2) DEFAULT 0,
  payment_details JSONB,
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 9. Tabla `sale_items` (Items de Venta)
```sql
CREATE TABLE sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id),
  variant_id UUID NOT NULL REFERENCES product_variants(id),
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 🔧 Funciones SQL Personalizadas

### 1. Función `open_cash_register`
```sql
CREATE OR REPLACE FUNCTION open_cash_register(
  p_branch_id UUID,
  p_opening_amount DECIMAL(10,2),
  p_opening_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_cash_register_id UUID;
  v_user_id UUID;
BEGIN
  -- Obtener el usuario actual (asumiendo que se pasa desde la aplicación)
  v_user_id := auth.uid();
  
  -- Verificar que no haya caja abierta
  IF EXISTS (
    SELECT 1 FROM cash_registers 
    WHERE branch_id = p_branch_id AND status = 'ABIERTA'
  ) THEN
    RAISE EXCEPTION 'Ya existe una caja abierta en esta sucursal';
  END IF;
  
  -- Crear nueva caja
  INSERT INTO cash_registers (
    branch_id, user_id, opening_amount, opening_user_id, opening_notes
  ) VALUES (
    p_branch_id, v_user_id, p_opening_amount, v_user_id, p_opening_notes
  ) RETURNING id INTO v_cash_register_id;
  
  RETURN v_cash_register_id;
END;
$$;
```

### 2. Función `close_cash_register`
```sql
CREATE OR REPLACE FUNCTION close_cash_register(
  p_cash_register_id UUID,
  p_closing_amount DECIMAL(10,2),
  p_closing_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
  v_expected_total DECIMAL(10,2);
  v_cash_difference DECIMAL(10,2);
BEGIN
  v_user_id := auth.uid();
  
  -- Obtener total esperado
  SELECT expected_total INTO v_expected_total
  FROM cash_registers WHERE id = p_cash_register_id;
  
  -- Calcular diferencia
  v_cash_difference := p_closing_amount - v_expected_total;
  
  -- Cerrar caja
  UPDATE cash_registers SET
    status = 'CERRADA',
    closing_date = NOW(),
    closing_amount = p_closing_amount,
    closing_user_id = v_user_id,
    closing_notes = p_closing_notes,
    cash_difference = v_cash_difference,
    updated_at = NOW()
  WHERE id = p_cash_register_id;
END;
$$;
```

### 3. Función `get_open_cash_register`
```sql
CREATE OR REPLACE FUNCTION get_open_cash_register(p_branch_id UUID)
RETURNS TABLE (
  id UUID,
  opening_date TIMESTAMP WITH TIME ZONE,
  opening_amount DECIMAL(10,2),
  opening_user_name VARCHAR(255),
  opening_notes TEXT,
  expected_cash DECIMAL(10,2),
  expected_qr DECIMAL(10,2),
  expected_card DECIMAL(10,2),
  expected_total DECIMAL(10,2)
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cr.id,
    cr.opening_date,
    cr.opening_amount,
    u.name as opening_user_name,
    cr.opening_notes,
    cr.expected_cash,
    cr.expected_qr,
    cr.expected_card,
    cr.expected_total
  FROM cash_registers cr
  JOIN users u ON cr.opening_user_id = u.id
  WHERE cr.branch_id = p_branch_id 
    AND cr.status = 'ABIERTA';
END;
$$;
```

### 4. Función `get_cash_movements`
```sql
CREATE OR REPLACE FUNCTION get_cash_movements(p_cash_register_id UUID)
RETURNS TABLE (
  id UUID,
  movement_type VARCHAR(50),
  payment_type VARCHAR(50),
  amount DECIMAL(10,2),
  description TEXT,
  reference_id UUID,
  reference_type VARCHAR(50),
  user_name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cm.id,
    cm.movement_type,
    cm.payment_type,
    cm.amount,
    cm.description,
    cm.reference_id,
    cm.reference_type,
    u.name as user_name,
    cm.created_at
  FROM cash_movements cm
  JOIN users u ON cm.user_id = u.id
  WHERE cm.cash_register_id = p_cash_register_id
  ORDER BY cm.created_at DESC;
END;
$$;
```

### 5. Función `get_cash_register_summary`
```sql
CREATE OR REPLACE FUNCTION get_cash_register_summary(p_cash_register_id UUID)
RETURNS TABLE (
  opening_amount DECIMAL(10,2),
  expected_cash DECIMAL(10,2),
  expected_qr DECIMAL(10,2),
  expected_card DECIMAL(10,2),
  expected_total DECIMAL(10,2),
  closing_amount DECIMAL(10,2),
  cash_difference DECIMAL(10,2),
  total_sales DECIMAL(10,2),
  total_movements DECIMAL(10,2)
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cr.opening_amount,
    cr.expected_cash,
    cr.expected_qr,
    cr.expected_card,
    cr.expected_total,
    cr.closing_amount,
    cr.cash_difference,
    COALESCE(SUM(s.total), 0) as total_sales,
    COALESCE(SUM(CASE WHEN cm.movement_type = 'INGRESO' THEN cm.amount ELSE -cm.amount END), 0) as total_movements
  FROM cash_registers cr
  LEFT JOIN sales s ON s.branch_id = cr.branch_id 
    AND DATE(s.sale_date) = DATE(cr.opening_date)
  LEFT JOIN cash_movements cm ON cm.cash_register_id = cr.id
  WHERE cr.id = p_cash_register_id
  GROUP BY cr.id, cr.opening_amount, cr.expected_cash, cr.expected_qr, cr.expected_card, 
           cr.expected_total, cr.closing_amount, cr.cash_difference;
END;
$$;
```

### 6. Función `get_cash_register_history`
```sql
CREATE OR REPLACE FUNCTION get_cash_register_history(
  p_branch_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  id UUID,
  opening_date TIMESTAMP WITH TIME ZONE,
  closing_date TIMESTAMP WITH TIME ZONE,
  opening_amount DECIMAL(10,2),
  closing_amount DECIMAL(10,2),
  expected_total DECIMAL(10,2),
  cash_difference DECIMAL(10,2),
  opening_user_name VARCHAR(255),
  closing_user_name VARCHAR(255),
  status VARCHAR(50)
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cr.id,
    cr.opening_date,
    cr.closing_date,
    cr.opening_amount,
    cr.closing_amount,
    cr.expected_total,
    cr.cash_difference,
    opening_user.name as opening_user_name,
    closing_user.name as closing_user_name,
    cr.status
  FROM cash_registers cr
  JOIN users opening_user ON cr.opening_user_id = opening_user.id
  LEFT JOIN users closing_user ON cr.closing_user_id = closing_user.id
  WHERE cr.branch_id = p_branch_id
    AND DATE(cr.opening_date) BETWEEN p_start_date AND p_end_date
  ORDER BY cr.opening_date DESC;
END;
$$;
```

### 7. Función `sum_total_sales`
```sql
CREATE OR REPLACE FUNCTION sum_total_sales(
  payment_type_param VARCHAR(50) DEFAULT NULL,
  sale_date_param DATE DEFAULT CURRENT_DATE,
  branch_id_param UUID DEFAULT NULL
)
RETURNS DECIMAL(10,2)
LANGUAGE plpgsql
AS $$
DECLARE
  v_total DECIMAL(10,2);
BEGIN
  SELECT COALESCE(SUM(total), 0) INTO v_total
  FROM sales
  WHERE (payment_type_param IS NULL OR payment_type = payment_type_param)
    AND sale_date = sale_date_param
    AND (branch_id_param IS NULL OR branch_id = branch_id_param);
  
  RETURN v_total;
END;
$$;
```

### 8. Función `sum_total_sales_card`
```sql
CREATE OR REPLACE FUNCTION sum_total_sales_card(
  sale_date_param DATE DEFAULT CURRENT_DATE,
  branch_id_param UUID DEFAULT NULL
)
RETURNS DECIMAL(10,2)
LANGUAGE plpgsql
AS $$
DECLARE
  v_total DECIMAL(10,2);
BEGIN
  SELECT COALESCE(SUM(total), 0) INTO v_total
  FROM sales
  WHERE payment_type = 'TARJETA'
    AND sale_date = sale_date_param
    AND (branch_id_param IS NULL OR branch_id = branch_id_param);
  
  RETURN v_total;
END;
$$;
```

## 🔄 Triggers Automáticos

### 1. Trigger para actualizar totales de caja
```sql
CREATE OR REPLACE FUNCTION update_cash_register_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Actualizar totales cuando se agrega una venta
  IF TG_OP = 'INSERT' AND TG_TABLE_NAME = 'sales' THEN
    UPDATE cash_registers SET
      expected_total = expected_total + NEW.total,
      expected_cash = CASE WHEN NEW.payment_type = 'EFECTIVO' THEN expected_cash + NEW.total ELSE expected_cash END,
      expected_qr = CASE WHEN NEW.payment_type = 'QR' THEN expected_qr + NEW.total ELSE expected_qr END,
      expected_card = CASE WHEN NEW.payment_type = 'TARJETA' THEN expected_card + NEW.total ELSE expected_card END,
      updated_at = NOW()
    WHERE branch_id = NEW.branch_id AND status = 'ABIERTA';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_cash_register_totals
  AFTER INSERT ON sales
  FOR EACH ROW
  EXECUTE FUNCTION update_cash_register_totals();
```

### 2. Trigger para actualizar inventario
```sql
CREATE OR REPLACE FUNCTION update_stock_quantity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Actualizar stock cuando se vende
  IF TG_OP = 'INSERT' AND TG_TABLE_NAME = 'sale_items' THEN
    UPDATE stock SET
      quantity = quantity - NEW.quantity,
      updated_at = NOW()
    WHERE variant_id = NEW.variant_id;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_stock_quantity
  AFTER INSERT ON sale_items
  FOR EACH ROW
  EXECUTE FUNCTION update_stock_quantity();
```

## 📊 Vistas para Reportes

### 1. Vista de resumen diario
```sql
CREATE VIEW daily_summary AS
SELECT 
  DATE(s.sale_date) as date,
  s.branch_id,
  b.name as branch_name,
  COUNT(s.id) as total_sales,
  SUM(s.total) as total_amount,
  AVG(s.total) as average_sale,
  SUM(CASE WHEN s.payment_type = 'EFECTIVO' THEN s.total ELSE 0 END) as cash_total,
  SUM(CASE WHEN s.payment_type = 'QR' THEN s.total ELSE 0 END) as qr_total,
  SUM(CASE WHEN s.payment_type = 'TARJETA' THEN s.total ELSE 0 END) as card_total
FROM sales s
JOIN branches b ON s.branch_id = b.id
GROUP BY DATE(s.sale_date), s.branch_id, b.name
ORDER BY date DESC, branch_name;
```

### 2. Vista de productos más vendidos
```sql
CREATE VIEW top_products AS
SELECT 
  p.name as product_name,
  pv.size,
  SUM(si.quantity) as total_sold,
  SUM(si.subtotal) as total_revenue
FROM sale_items si
JOIN product_variants pv ON si.variant_id = pv.id
JOIN products p ON pv.product_id = p.id
GROUP BY p.id, p.name, pv.size
ORDER BY total_sold DESC;
```

## 🚫 Configuración SIN Políticas RLS

```sql
-- Deshabilitar RLS en todas las tablas
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE branches DISABLE ROW LEVEL SECURITY;
ALTER TABLE cash_registers DISABLE ROW LEVEL SECURITY;
ALTER TABLE cash_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock DISABLE ROW LEVEL SECURITY;
ALTER TABLE sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items DISABLE ROW LEVEL SECURITY;
```

## 🔑 Índices para Rendimiento

```sql
-- Índices principales
CREATE INDEX idx_cash_registers_branch_status ON cash_registers(branch_id, status);
CREATE INDEX idx_cash_movements_register ON cash_movements(cash_register_id);
CREATE INDEX idx_sales_branch_date ON sales(branch_id, sale_date);
CREATE INDEX idx_sales_payment_type ON sales(payment_type);
CREATE INDEX idx_stock_branch_variant ON stock(branch_id, variant_id);
CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);

-- Índices para búsquedas
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_users_branch ON users(branch_id);
CREATE INDEX idx_cash_registers_opening_date ON cash_registers(opening_date);
```

## 📱 Funcionalidades del Frontend

### 1. Página de Flujo de Caja (`/cash-flow`)
- **Abrir Caja**: Modal con monto inicial y observaciones
- **Cerrar Caja**: Modal con monto contado y observaciones
- **Agregar Movimiento**: Modal para ingresos/egresos manuales
- **Historial**: Tabla con todas las cajas abiertas/cerradas
- **Dashboard**: Resumen de ventas del día y estado actual
- **Redirección a Ventas**: Botón para ir a ventas después de agregar movimiento

### 2. Página de Ventas (`/sales`)
- **Catálogo de Productos**: Grid con productos disponibles
- **Carrito de Compras**: Lista de productos seleccionados
- **Métodos de Pago**: Efectivo, QR, Tarjeta, Mixto
- **Descuentos**: Campo para aplicar descuentos
- **Finalizar Venta**: Proceso de checkout completo

### 3. Página de Productos (`/products`)
- **Gestión de Productos**: CRUD completo
- **Variantes**: Tallas y especificaciones
- **Inventario**: Control de stock por sucursal
- **Imágenes**: Subida y gestión de imágenes

### 4. Dashboard Principal (`/dashboard`)
- **Resumen de Ventas**: Gráficos y estadísticas
- **Productos Populares**: Top de ventas
- **Stock Bajo**: Alertas de inventario
- **Ventas por Sucursal**: Comparativas

## 🎨 Diseño y UX

### Estilo Visual
- **Paleta de Colores**: Azules, verdes, grises profesionales
- **Iconografía**: Lucide React para consistencia
- **Tipografía**: Inter o similar para legibilidad
- **Espaciado**: Sistema de espaciado consistente con Tailwind

### Componentes UI
- **Botones**: Variantes primario, secundario, éxito, peligro
- **Modales**: Responsivos con overlay y animaciones
- **Tablas**: Con hover effects y paginación
- **Formularios**: Validación en tiempo real
- **Cards**: Para mostrar información resumida

### Responsividad
- **Mobile First**: Diseño optimizado para móviles
- **Breakpoints**: sm, md, lg, xl con Tailwind
- **Navegación**: Sidebar colapsable en móviles
- **Tablas**: Scroll horizontal en dispositivos pequeños

## 🔐 Autenticación y Autorización

### Supabase Auth
- **Login/Logout**: Sistema de autenticación completo
- **Roles**: Admin y Vendedor con permisos diferentes
- **Sucursales**: Usuarios asignados a sucursales específicas
- **Sesiones**: Manejo de sesiones persistentes

### Control de Acceso
- **Middleware**: Verificación de autenticación en rutas
- **Permisos**: Diferentes vistas según rol del usuario
- **Sucursal Activa**: Selección y cambio de sucursal

## 📊 Reportes y Analytics

### Reportes Disponibles
- **Ventas Diarias**: Por sucursal y método de pago
- **Flujo de Caja**: Movimientos y balance
- **Productos**: Rendimiento y stock
- **Usuarios**: Actividad y ventas por vendedor

### Exportación
- **PDF**: Reportes imprimibles
- **Excel**: Datos para análisis externo
- **Impresión**: Formato optimizado para impresoras

## 🚀 Deployment y Configuración

### Variables de Entorno
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_APP_NAME=Clothing Store POS
VITE_APP_VERSION=1.0.0
```

### Build y Deploy
- **Vite**: Configuración optimizada para producción
- **Tailwind**: Purge CSS para reducir tamaño
- **TypeScript**: Compilación estricta
- **Netlify/Vercel**: Deploy automático desde GitHub

## 📝 Notas Importantes

1. **Sin RLS**: El sistema no usa políticas de seguridad a nivel de fila
2. **Funciones SQL**: Toda la lógica de negocio está en funciones PostgreSQL
3. **Triggers**: Cálculos automáticos de totales y stock
4. **Real-time**: Supabase subscriptions para actualizaciones en tiempo real
5. **Offline**: PWA capabilities para funcionamiento offline
6. **Backup**: Sistema de respaldo automático de Supabase

## 🎯 Objetivos del Sistema

- ✅ **Gestión Completa de Caja**: Apertura, cierre, movimientos
- ✅ **Ventas Automáticas**: Integración con inventario
- ✅ **Reportes Detallados**: Analytics y exportación
- ✅ **Multi-sucursal**: Soporte para múltiples tiendas
- ✅ **Usuario Amigable**: Interface intuitiva y responsive
- ✅ **Escalable**: Arquitectura que crece con el negocio
- ✅ **Confiable**: Sin errores de constraint o datos corruptos

---

**Este prompt debe generar un sistema completo y funcional que maneje todo el flujo de caja de una tienda de ropa, con Supabase como backend y una interfaz moderna y responsive.**

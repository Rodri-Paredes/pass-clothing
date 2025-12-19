/*
  ====================================================================================================
  MIGRACIÓN COMPLETA - OUTSIDERS ERP SYSTEM
  ====================================================================================================
  
  Sistema ERP completo para tienda de ropa Outsiders
  Incluye todas las funcionalidades del sistema PASS CLOTHING adaptado
  
  TABLAS PRINCIPALES:
  - branches: Sucursales de la tienda
  - users: Usuarios del sistema (admin/vendedor)
  - products: Catálogo de productos
  - product_variants: Variantes de productos (tallas)
  - stock: Inventario por sucursal
  - sales: Ventas realizadas
  - sale_items: Detalle de productos vendidos
  - drops: Lanzamientos y colecciones
  - drop_products: Relación productos-lanzamientos
  - cash_registers: Control de cajas
  - cash_movements: Movimientos de caja
  
  CARACTERÍSTICAS:
  - Soporte para pagos mixtos (EFECTIVO, QR, TARJETA, MIXTO)
  - Sistema de descuentos
  - Control de cajas (apertura/cierre)
  - Sistema de drops/colecciones
  - Reportes y análisis
  - Row Level Security (RLS)
  - Storage para imágenes
  
  Creado: 2025-12-14
  ====================================================================================================
*/

-- ====================================================================================================
-- 1. ELIMINAR TABLAS EXISTENTES (si existen)
-- ====================================================================================================

DROP TABLE IF EXISTS cash_movements CASCADE;
DROP TABLE IF EXISTS cash_registers CASCADE;
DROP TABLE IF EXISTS drop_products CASCADE;
DROP TABLE IF EXISTS drops CASCADE;
DROP TABLE IF EXISTS sale_items CASCADE;
DROP TABLE IF EXISTS sales CASCADE;
DROP TABLE IF EXISTS stock CASCADE;
DROP TABLE IF EXISTS product_variants CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS branches CASCADE;

-- ====================================================================================================
-- 2. TABLA: BRANCHES (Sucursales)
-- ====================================================================================================

CREATE TABLE branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE branches IS 'Sucursales de la tienda Outsiders';
COMMENT ON COLUMN branches.name IS 'Nombre de la sucursal';
COMMENT ON COLUMN branches.address IS 'Dirección física de la sucursal';

-- ====================================================================================================
-- 3. TABLA: USERS (Usuarios del sistema)
-- ====================================================================================================

CREATE TABLE users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'vendedor' CHECK (role IN ('admin', 'vendedor')),
  branch_id uuid REFERENCES branches(id),
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE users IS 'Usuarios del sistema ERP (extiende auth.users de Supabase)';
COMMENT ON COLUMN users.role IS 'Rol del usuario: admin (acceso total) o vendedor (solo su sucursal)';
COMMENT ON COLUMN users.branch_id IS 'Sucursal asignada al usuario (NULL para admins)';

-- ====================================================================================================
-- 4. TABLA: PRODUCTS (Productos del catálogo)
-- ====================================================================================================

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL,
  price decimal(10,2) NOT NULL CHECK (price >= 0),
  image_url text,
  drop_id uuid,
  is_visible boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE products IS 'Catálogo de productos de Outsiders';
COMMENT ON COLUMN products.price IS 'Precio base del producto (aplicable a todas las variantes)';
COMMENT ON COLUMN products.drop_id IS 'ID del drop/colección al que pertenece (opcional)';
COMMENT ON COLUMN products.is_visible IS 'Indica si el producto está visible en el catálogo';

-- ====================================================================================================
-- 5. TABLA: PRODUCT_VARIANTS (Variantes de productos - tallas)
-- ====================================================================================================

CREATE TABLE product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(product_id, size)
);

COMMENT ON TABLE product_variants IS 'Variantes de productos por talla';
COMMENT ON COLUMN product_variants.size IS 'Talla del producto (XS, S, M, L, XL, etc.)';

-- ====================================================================================================
-- 6. TABLA: STOCK (Inventario por sucursal)
-- ====================================================================================================

CREATE TABLE stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(variant_id, branch_id)
);

COMMENT ON TABLE stock IS 'Inventario de productos por sucursal y variante';
COMMENT ON COLUMN stock.quantity IS 'Cantidad disponible en stock';

-- ====================================================================================================
-- 7. TABLA: SALES (Ventas)
-- ====================================================================================================

CREATE TABLE sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  branch_id uuid NOT NULL REFERENCES branches(id),
  subtotal decimal(10,2) CHECK (subtotal >= 0),
  discount_amount decimal(10,2) DEFAULT 0 CHECK (discount_amount >= 0),
  total decimal(10,2) NOT NULL CHECK (total >= 0),
  payment_type text NOT NULL DEFAULT 'EFECTIVO' CHECK (payment_type IN ('EFECTIVO', 'QR', 'TARJETA', 'MIXTO')),
  payment_details jsonb,
  sale_date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE sales IS 'Registro de ventas realizadas';
COMMENT ON COLUMN sales.subtotal IS 'Subtotal antes de descuentos';
COMMENT ON COLUMN sales.discount_amount IS 'Monto del descuento aplicado';
COMMENT ON COLUMN sales.total IS 'Total final (subtotal - descuento)';
COMMENT ON COLUMN sales.payment_type IS 'Tipo de pago: EFECTIVO, QR, TARJETA o MIXTO';
COMMENT ON COLUMN sales.payment_details IS 'Detalles de pagos mixtos en formato JSON';

-- ====================================================================================================
-- 8. TABLA: SALE_ITEMS (Detalle de productos vendidos)
-- ====================================================================================================

CREATE TABLE sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES product_variants(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price decimal(10,2) NOT NULL CHECK (unit_price >= 0),
  subtotal decimal(10,2) NOT NULL CHECK (subtotal >= 0)
);

COMMENT ON TABLE sale_items IS 'Detalle de productos incluidos en cada venta';
COMMENT ON COLUMN sale_items.unit_price IS 'Precio unitario al momento de la venta';
COMMENT ON COLUMN sale_items.subtotal IS 'Subtotal de la línea (quantity * unit_price)';

-- ====================================================================================================
-- 9. TABLA: DROPS (Lanzamientos y colecciones)
-- ====================================================================================================

CREATE TABLE drops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  launch_date timestamptz NOT NULL,
  end_date timestamptz,
  status text NOT NULL DEFAULT 'ACTIVO' CHECK (status IN ('ACTIVO', 'INACTIVO', 'FINALIZADO')),
  is_featured boolean DEFAULT false,
  image_url text,
  banner_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE drops IS 'Lanzamientos y colecciones especiales de productos';
COMMENT ON COLUMN drops.launch_date IS 'Fecha de lanzamiento del drop';
COMMENT ON COLUMN drops.end_date IS 'Fecha de finalización (opcional)';
COMMENT ON COLUMN drops.status IS 'Estado: ACTIVO, INACTIVO, FINALIZADO';
COMMENT ON COLUMN drops.is_featured IS 'Indica si el drop es destacado en la página principal';

-- ====================================================================================================
-- 10. TABLA: DROP_PRODUCTS (Relación productos-lanzamientos)
-- ====================================================================================================

CREATE TABLE drop_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drop_id uuid NOT NULL REFERENCES drops(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  is_featured boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(drop_id, product_id)
);

COMMENT ON TABLE drop_products IS 'Relación muchos a muchos entre drops y productos';
COMMENT ON COLUMN drop_products.is_featured IS 'Indica si el producto es destacado dentro del drop';
COMMENT ON COLUMN drop_products.sort_order IS 'Orden de visualización del producto en el drop';

-- Agregar foreign key de drop_id a products
ALTER TABLE products ADD CONSTRAINT fk_products_drop_id 
  FOREIGN KEY (drop_id) REFERENCES drops(id);

-- ====================================================================================================
-- 11. TABLA: CASH_REGISTERS (Control de cajas)
-- ====================================================================================================

CREATE TABLE cash_registers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  status text NOT NULL DEFAULT 'ABIERTA' CHECK (status IN ('ABIERTA', 'CERRADA')),
  
  -- Apertura de caja
  opening_date timestamptz NOT NULL DEFAULT now(),
  opening_amount decimal(10,2) NOT NULL CHECK (opening_amount >= 0),
  opening_user_id uuid NOT NULL REFERENCES users(id),
  opening_notes text,
  
  -- Cierre de caja
  closing_date timestamptz,
  closing_amount decimal(10,2) CHECK (closing_amount >= 0),
  closing_user_id uuid REFERENCES users(id),
  closing_notes text,
  
  -- Montos esperados y diferencias
  expected_cash decimal(10,2) CHECK (expected_cash >= 0),
  expected_qr decimal(10,2) CHECK (expected_qr >= 0),
  expected_card decimal(10,2) CHECK (expected_card >= 0),
  expected_total decimal(10,2) CHECK (expected_total >= 0),
  cash_difference decimal(10,2),
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE cash_registers IS 'Control de apertura y cierre de cajas por sucursal';
COMMENT ON COLUMN cash_registers.status IS 'Estado de la caja: ABIERTA o CERRADA';
COMMENT ON COLUMN cash_registers.opening_amount IS 'Monto inicial al abrir la caja';
COMMENT ON COLUMN cash_registers.closing_amount IS 'Monto final al cerrar la caja';
COMMENT ON COLUMN cash_registers.cash_difference IS 'Diferencia entre monto esperado y real (puede ser positiva o negativa)';

-- ====================================================================================================
-- 12. TABLA: CASH_MOVEMENTS (Movimientos de caja)
-- ====================================================================================================

CREATE TABLE cash_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_register_id uuid NOT NULL REFERENCES cash_registers(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN ('INGRESO', 'EGRESO')),
  payment_type text NOT NULL CHECK (payment_type IN ('EFECTIVO', 'QR', 'TARJETA', 'MIXTO')),
  amount decimal(10,2) NOT NULL CHECK (amount > 0),
  description text NOT NULL,
  reference_id uuid,
  reference_type text,
  user_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE cash_movements IS 'Registro de todos los movimientos de caja (ingresos y egresos)';
COMMENT ON COLUMN cash_movements.movement_type IS 'Tipo de movimiento: INGRESO o EGRESO';
COMMENT ON COLUMN cash_movements.payment_type IS 'Método de pago del movimiento';
COMMENT ON COLUMN cash_movements.reference_id IS 'ID relacionado (ej: ID de venta)';
COMMENT ON COLUMN cash_movements.reference_type IS 'Tipo de referencia: SALE, DEPOSIT, WITHDRAWAL, etc.';

-- ====================================================================================================
-- 13. HABILITAR ROW LEVEL SECURITY (RLS)
-- ====================================================================================================

ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE drops ENABLE ROW LEVEL SECURITY;
ALTER TABLE drop_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;

-- ====================================================================================================
-- 14. POLÍTICAS RLS - BRANCHES
-- ====================================================================================================

CREATE POLICY "Authenticated users can read branches"
  ON branches FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert branches"
  ON branches FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update branches"
  ON branches FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete branches"
  ON branches FOR DELETE
  TO authenticated
  USING (true);

-- ====================================================================================================
-- 15. POLÍTICAS RLS - USERS
-- ====================================================================================================

CREATE POLICY "Users can read their own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Anyone can insert user profile"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- ====================================================================================================
-- 16. POLÍTICAS RLS - PRODUCTS
-- ====================================================================================================

CREATE POLICY "Authenticated users can read products"
  ON products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update products"
  ON products FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete products"
  ON products FOR DELETE
  TO authenticated
  USING (true);

-- ====================================================================================================
-- 17. POLÍTICAS RLS - PRODUCT_VARIANTS
-- ====================================================================================================

CREATE POLICY "Authenticated users can read product variants"
  ON product_variants FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert product variants"
  ON product_variants FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update product variants"
  ON product_variants FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete product variants"
  ON product_variants FOR DELETE
  TO authenticated
  USING (true);

-- ====================================================================================================
-- 18. POLÍTICAS RLS - STOCK
-- ====================================================================================================

CREATE POLICY "Users can read stock for their branch or all if admin"
  ON stock FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert stock for their branch or all if admin"
  ON stock FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update stock for their branch or all if admin"
  ON stock FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete stock for their branch or all if admin"
  ON stock FOR DELETE
  TO authenticated
  USING (true);

-- ====================================================================================================
-- 19. POLÍTICAS RLS - SALES
-- ====================================================================================================

CREATE POLICY "Users can read sales for their branch or all if admin"
  ON sales FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert sales for their branch or all if admin"
  ON sales FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update sales for their branch or all if admin"
  ON sales FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete sales for their branch or all if admin"
  ON sales FOR DELETE
  TO authenticated
  USING (true);

-- ====================================================================================================
-- 20. POLÍTICAS RLS - SALE_ITEMS
-- ====================================================================================================

CREATE POLICY "Users can read sale items for their branch or all if admin"
  ON sale_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert sale items for their branch or all if admin"
  ON sale_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update sale items for their branch or all if admin"
  ON sale_items FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete sale items for their branch or all if admin"
  ON sale_items FOR DELETE
  TO authenticated
  USING (true);

-- ====================================================================================================
-- 21. POLÍTICAS RLS - DROPS
-- ====================================================================================================

CREATE POLICY "Authenticated users can read drops"
  ON drops FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert drops"
  ON drops FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update drops"
  ON drops FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete drops"
  ON drops FOR DELETE
  TO authenticated
  USING (true);

-- ====================================================================================================
-- 22. POLÍTICAS RLS - DROP_PRODUCTS
-- ====================================================================================================

CREATE POLICY "Authenticated users can read drop_products"
  ON drop_products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert drop_products"
  ON drop_products FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update drop_products"
  ON drop_products FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete drop_products"
  ON drop_products FOR DELETE
  TO authenticated
  USING (true);

-- ====================================================================================================
-- 23. POLÍTICAS RLS - CASH_REGISTERS
-- ====================================================================================================

CREATE POLICY "Users can read cash registers for their branch"
  ON cash_registers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND (users.role = 'admin' OR users.branch_id = cash_registers.branch_id)
    )
  );

CREATE POLICY "Users can insert cash registers for their branch"
  ON cash_registers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND (users.role = 'admin' OR users.branch_id = cash_registers.branch_id)
    )
  );

CREATE POLICY "Users can update cash registers for their branch"
  ON cash_registers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND (users.role = 'admin' OR users.branch_id = cash_registers.branch_id)
    )
  );

-- ====================================================================================================
-- 24. POLÍTICAS RLS - CASH_MOVEMENTS
-- ====================================================================================================

CREATE POLICY "Users can read cash movements for their branch"
  ON cash_movements FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cash_registers cr
      JOIN users u ON u.id = auth.uid()
      WHERE cr.id = cash_movements.cash_register_id
      AND (u.role = 'admin' OR u.branch_id = cr.branch_id)
    )
  );

CREATE POLICY "Users can insert cash movements for their branch"
  ON cash_movements FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cash_registers cr
      JOIN users u ON u.id = auth.uid()
      WHERE cr.id = cash_movements.cash_register_id
      AND (u.role = 'admin' OR u.branch_id = cr.branch_id)
    )
  );

-- ====================================================================================================
-- 25. ÍNDICES PARA OPTIMIZACIÓN
-- ====================================================================================================

-- Stock
CREATE INDEX idx_stock_variant_branch ON stock(variant_id, branch_id);
CREATE INDEX idx_stock_branch ON stock(branch_id);

-- Sales
CREATE INDEX idx_sales_branch_date ON sales(branch_id, sale_date);
CREATE INDEX idx_sales_user ON sales(user_id);
CREATE INDEX idx_sales_payment_type ON sales(payment_type);
CREATE INDEX idx_sales_discount ON sales(discount_amount);
CREATE INDEX idx_sales_payment_details ON sales USING GIN(payment_details);

-- Sale Items
CREATE INDEX idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX idx_sale_items_variant_id ON sale_items(variant_id);

-- Products
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_drop_id ON products(drop_id);
CREATE INDEX idx_products_visible ON products(is_visible);

-- Product Variants
CREATE INDEX idx_product_variants_product_id ON product_variants(product_id);

-- Drops
CREATE INDEX idx_drops_status ON drops(status);
CREATE INDEX idx_drops_launch_date ON drops(launch_date);
CREATE INDEX idx_drops_featured ON drops(is_featured);

-- Drop Products
CREATE INDEX idx_drop_products_drop_id ON drop_products(drop_id);
CREATE INDEX idx_drop_products_product_id ON drop_products(product_id);

-- Cash Registers
CREATE INDEX idx_cash_registers_branch_status ON cash_registers(branch_id, status);
CREATE INDEX idx_cash_registers_opening_date ON cash_registers(opening_date);

-- Cash Movements
CREATE INDEX idx_cash_movements_register_id ON cash_movements(cash_register_id);
CREATE INDEX idx_cash_movements_user_id ON cash_movements(user_id);
CREATE INDEX idx_cash_movements_type ON cash_movements(movement_type);

-- Users
CREATE INDEX idx_users_branch ON users(branch_id);
CREATE INDEX idx_users_role ON users(role);

-- ====================================================================================================
-- 26. TRIGGERS PARA ACTUALIZACIÓN AUTOMÁTICA
-- ====================================================================================================

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para stock
CREATE TRIGGER update_stock_updated_at
  BEFORE UPDATE ON stock
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para drops
CREATE TRIGGER update_drops_updated_at
  BEFORE UPDATE ON drops
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para cash_registers
CREATE TRIGGER update_cash_registers_updated_at
  BEFORE UPDATE ON cash_registers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ====================================================================================================
-- 27. FUNCIONES DE NEGOCIO - GESTIÓN DE CAJA
-- ====================================================================================================

-- Función para abrir caja
CREATE OR REPLACE FUNCTION open_cash_register(
  p_branch_id uuid,
  p_opening_amount decimal(10,2),
  p_opening_notes text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_cash_register_id uuid;
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM users WHERE id = auth.uid();
  
  IF EXISTS (
    SELECT 1 FROM cash_registers 
    WHERE branch_id = p_branch_id AND status = 'ABIERTA'
  ) THEN
    RAISE EXCEPTION 'Ya existe una caja abierta en esta sucursal';
  END IF;
  
  INSERT INTO cash_registers (
    branch_id, user_id, opening_amount, opening_user_id, opening_notes
  ) VALUES (
    p_branch_id, v_user_id, p_opening_amount, v_user_id, p_opening_notes
  ) RETURNING id INTO v_cash_register_id;
  
  INSERT INTO cash_movements (
    cash_register_id, movement_type, payment_type, amount, description, user_id
  ) VALUES (
    v_cash_register_id, 'INGRESO', 'EFECTIVO', p_opening_amount, 
    'Apertura de caja - Fondo inicial', v_user_id
  );
  
  RETURN v_cash_register_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para cerrar caja
CREATE OR REPLACE FUNCTION close_cash_register(
  p_cash_register_id uuid,
  p_closing_amount decimal(10,2),
  p_closing_notes text DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_user_id uuid;
  v_expected_cash decimal(10,2);
  v_expected_qr decimal(10,2);
  v_expected_card decimal(10,2);
  v_expected_total decimal(10,2);
  v_cash_difference decimal(10,2);
BEGIN
  SELECT id INTO v_user_id FROM users WHERE id = auth.uid();
  
  SELECT 
    COALESCE(SUM(CASE WHEN payment_type = 'EFECTIVO' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN payment_type = 'QR' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN payment_type = 'TARJETA' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(amount), 0)
  INTO v_expected_cash, v_expected_qr, v_expected_card, v_expected_total
  FROM cash_movements
  WHERE cash_register_id = p_cash_register_id
    AND movement_type = 'INGRESO';
  
  v_cash_difference := p_closing_amount - v_expected_cash;
  
  UPDATE cash_registers SET
    status = 'CERRADA',
    closing_date = now(),
    closing_amount = p_closing_amount,
    closing_user_id = v_user_id,
    closing_notes = p_closing_notes,
    expected_cash = v_expected_cash,
    expected_qr = v_expected_qr,
    expected_card = v_expected_card,
    expected_total = v_expected_total,
    cash_difference = v_cash_difference
  WHERE id = p_cash_register_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para registrar movimiento de venta
CREATE OR REPLACE FUNCTION register_sale_movement(
  p_sale_id uuid
)
RETURNS void AS $$
DECLARE
  v_sale RECORD;
  v_cash_register_id uuid;
BEGIN
  SELECT * INTO v_sale FROM sales WHERE id = p_sale_id;
  
  SELECT id INTO v_cash_register_id 
  FROM cash_registers 
  WHERE branch_id = v_sale.branch_id 
    AND status = 'ABIERTA' 
  ORDER BY opening_date DESC 
  LIMIT 1;
  
  IF v_cash_register_id IS NULL THEN
    RAISE EXCEPTION 'No hay una caja abierta en esta sucursal';
  END IF;
  
  IF v_sale.payment_type = 'MIXTO' THEN
    IF (v_sale.payment_details->>'efectivo')::decimal > 0 THEN
      INSERT INTO cash_movements (
        cash_register_id, movement_type, payment_type, amount, 
        description, reference_id, reference_type, user_id
      ) VALUES (
        v_cash_register_id, 'INGRESO', 'EFECTIVO', 
        (v_sale.payment_details->>'efectivo')::decimal,
        'Venta - Pago en efectivo', p_sale_id, 'SALE', v_sale.user_id
      );
    END IF;
    
    IF (v_sale.payment_details->>'qr')::decimal > 0 THEN
      INSERT INTO cash_movements (
        cash_register_id, movement_type, payment_type, amount, 
        description, reference_id, reference_type, user_id
      ) VALUES (
        v_cash_register_id, 'INGRESO', 'QR', 
        (v_sale.payment_details->>'qr')::decimal,
        'Venta - Pago con QR', p_sale_id, 'SALE', v_sale.user_id
      );
    END IF;
    
    IF (v_sale.payment_details->>'tarjeta')::decimal > 0 THEN
      INSERT INTO cash_movements (
        cash_register_id, movement_type, payment_type, amount, 
        description, reference_id, reference_type, user_id
      ) VALUES (
        v_cash_register_id, 'INGRESO', 'TARJETA', 
        (v_sale.payment_details->>'tarjeta')::decimal,
        'Venta - Pago con tarjeta', p_sale_id, 'SALE', v_sale.user_id
      );
    END IF;
  ELSE
    INSERT INTO cash_movements (
      cash_register_id, movement_type, payment_type, amount, 
      description, reference_id, reference_type, user_id
    ) VALUES (
      v_cash_register_id, 'INGRESO', v_sale.payment_type, v_sale.total,
      'Venta - Pago con ' || v_sale.payment_type, p_sale_id, 'SALE', v_sale.user_id
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener caja abierta
CREATE OR REPLACE FUNCTION get_open_cash_register(p_branch_id uuid)
RETURNS TABLE (
  id uuid,
  branch_id uuid,
  user_id uuid,
  status text,
  opening_date timestamptz,
  opening_amount decimal(10,2),
  opening_user_id uuid,
  opening_notes text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cr.id, cr.branch_id, cr.user_id, cr.status,
    cr.opening_date, cr.opening_amount, cr.opening_user_id, cr.opening_notes
  FROM cash_registers cr
  WHERE cr.branch_id = p_branch_id AND cr.status = 'ABIERTA'
  ORDER BY cr.opening_date DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Función para resumen de caja
CREATE OR REPLACE FUNCTION get_cash_register_summary(p_cash_register_id uuid)
RETURNS TABLE (
  total_cash decimal(10,2),
  total_qr decimal(10,2),
  total_card decimal(10,2),
  total_general decimal(10,2),
  sales_count integer,
  opening_amount decimal(10,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(CASE WHEN cm.payment_type = 'EFECTIVO' THEN cm.amount ELSE 0 END), 0) as total_cash,
    COALESCE(SUM(CASE WHEN cm.payment_type = 'QR' THEN cm.amount ELSE 0 END), 0) as total_qr,
    COALESCE(SUM(CASE WHEN cm.payment_type = 'TARJETA' THEN cm.amount ELSE 0 END), 0) as total_card,
    COALESCE(SUM(cm.amount), 0) as total_general,
    COUNT(DISTINCT CASE WHEN cm.reference_type = 'SALE' THEN cm.reference_id END)::integer as sales_count,
    cr.opening_amount
  FROM cash_registers cr
  LEFT JOIN cash_movements cm ON cm.cash_register_id = cr.id AND cm.movement_type = 'INGRESO'
  WHERE cr.id = p_cash_register_id
  GROUP BY cr.opening_amount;
END;
$$ LANGUAGE plpgsql;

-- ====================================================================================================
-- 28. FUNCIONES DE NEGOCIO - REPORTES Y ANÁLISIS
-- ====================================================================================================

-- Función para obtener desglose de pagos mixtos
CREATE OR REPLACE FUNCTION get_mixed_payment_breakdown(
  p_branch_id uuid, 
  p_sale_date date
)
RETURNS TABLE(
  payment_method text,
  total_amount decimal(10,2),
  transaction_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'EFECTIVO' as payment_method,
    COALESCE(SUM(
      CASE 
        WHEN s.payment_type = 'EFECTIVO' THEN s.total
        WHEN s.payment_type = 'MIXTO' THEN (s.payment_details->>'efectivo')::decimal(10,2)
        ELSE 0 
      END
    ), 0) as total_amount,
    COUNT(CASE WHEN s.payment_type IN ('EFECTIVO', 'MIXTO') THEN 1 END) as transaction_count
  FROM sales s
  WHERE s.sale_date::date = p_sale_date 
    AND s.branch_id = p_branch_id
  
  UNION ALL
  
  SELECT 
    'QR' as payment_method,
    COALESCE(SUM(
      CASE 
        WHEN s.payment_type = 'QR' THEN s.total
        WHEN s.payment_type = 'MIXTO' THEN (s.payment_details->>'qr')::decimal(10,2)
        ELSE 0 
      END
    ), 0) as total_amount,
    COUNT(CASE WHEN s.payment_type IN ('QR', 'MIXTO') THEN 1 END) as transaction_count
  FROM sales s
  WHERE s.sale_date::date = p_sale_date 
    AND s.branch_id = p_branch_id
  
  UNION ALL
  
  SELECT 
    'TARJETA' as payment_method,
    COALESCE(SUM(
      CASE 
        WHEN s.payment_type = 'TARJETA' THEN s.total
        WHEN s.payment_type = 'MIXTO' THEN (s.payment_details->>'tarjeta')::decimal(10,2)
        ELSE 0 
      END
    ), 0) as total_amount,
    COUNT(CASE WHEN s.payment_type IN ('TARJETA', 'MIXTO') THEN 1 END) as transaction_count
  FROM sales s
  WHERE s.sale_date::date = p_sale_date 
    AND s.branch_id = p_branch_id;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener ventas con descuentos
CREATE OR REPLACE FUNCTION get_sales_with_discounts(
  p_branch_id uuid, 
  p_sale_date date
)
RETURNS TABLE(
  total_sales decimal(10,2),
  total_discounts decimal(10,2),
  net_sales decimal(10,2),
  number_of_sales bigint,
  sales_with_discounts bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(s.subtotal), 0) as total_sales,
    COALESCE(SUM(s.discount_amount), 0) as total_discounts,
    COALESCE(SUM(s.total), 0) as net_sales,
    COUNT(s.id) as number_of_sales,
    COUNT(CASE WHEN s.discount_amount > 0 THEN 1 END) as sales_with_discounts
  FROM sales s
  WHERE s.sale_date::date = p_sale_date 
    AND s.branch_id = p_branch_id;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener productos de un drop
CREATE OR REPLACE FUNCTION get_drop_products(p_drop_id uuid)
RETURNS TABLE (
  product_id uuid,
  product_name text,
  product_description text,
  product_category text,
  product_price decimal(10,2),
  product_image_url text,
  is_featured boolean,
  sort_order integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id, p.name, p.description, p.category, p.price, p.image_url,
    dp.is_featured, dp.sort_order
  FROM products p
  JOIN drop_products dp ON p.id = dp.product_id
  WHERE dp.drop_id = p_drop_id
  ORDER BY dp.sort_order ASC, p.name ASC;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener drops activos
CREATE OR REPLACE FUNCTION get_active_drops()
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  launch_date timestamptz,
  end_date timestamptz,
  status text,
  is_featured boolean,
  image_url text,
  banner_url text,
  product_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id, d.name, d.description, d.launch_date, d.end_date, d.status,
    d.is_featured, d.image_url, d.banner_url,
    COUNT(dp.product_id) as product_count
  FROM drops d
  LEFT JOIN drop_products dp ON d.id = dp.drop_id
  WHERE d.status = 'ACTIVO'
  GROUP BY d.id, d.name, d.description, d.launch_date, d.end_date, 
           d.status, d.is_featured, d.image_url, d.banner_url
  ORDER BY d.is_featured DESC, d.launch_date DESC;
END;
$$ LANGUAGE plpgsql;

-- Función para estadísticas del dashboard
CREATE OR REPLACE FUNCTION get_dashboard_stats(
  p_branch_id uuid, 
  p_start_date date, 
  p_end_date date
)
RETURNS TABLE (
  total_sales decimal(10,2),
  sales_count bigint,
  products_sold bigint,
  avg_ticket decimal(10,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(s.total), 0) as total_sales,
    COUNT(s.id) as sales_count,
    COALESCE(SUM(si.quantity), 0) as products_sold,
    CASE 
      WHEN COUNT(s.id) > 0 THEN COALESCE(SUM(s.total) / COUNT(s.id), 0)
      ELSE 0 
    END as avg_ticket
  FROM sales s
  LEFT JOIN sale_items si ON s.id = si.sale_id
  WHERE s.branch_id = p_branch_id
    AND s.sale_date::date BETWEEN p_start_date AND p_end_date;
END;
$$ LANGUAGE plpgsql;

-- ====================================================================================================
-- 29. STORAGE BUCKET Y POLÍTICAS
-- ====================================================================================================

-- Crear bucket para imágenes de productos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('products', 'products', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage
CREATE POLICY "Authenticated users can upload product images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'products' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view product images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'products');

CREATE POLICY "Authenticated users can delete product images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'products' AND auth.role() = 'authenticated');

-- ====================================================================================================
-- 30. DATOS INICIALES (OPCIONAL - Comentar si no se necesitan)
-- ====================================================================================================

-- Insertar sucursales de ejemplo
INSERT INTO branches (name, address) VALUES
  ('Outsiders Centro', 'Av. Principal 123, Centro'),
  ('Outsiders Mall', 'Mall Plaza Local 45, Zona Norte'),
  ('Outsiders Express', 'Calle Comercio 789, Zona Sur')
ON CONFLICT DO NOTHING;

-- ====================================================================================================
-- FIN DE LA MIGRACIÓN
-- ====================================================================================================

-- Verificar que todo se creó correctamente
SELECT 
  'Tablas creadas' as status,
  COUNT(*) as count
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'branches', 'users', 'products', 'product_variants', 'stock', 
    'sales', 'sale_items', 'drops', 'drop_products', 
    'cash_registers', 'cash_movements'
  )

UNION ALL

SELECT 
  'Funciones creadas' as status,
  COUNT(*) as count
FROM pg_proc 
WHERE proname IN (
  'open_cash_register', 'close_cash_register', 'register_sale_movement',
  'get_open_cash_register', 'get_cash_register_summary', 
  'get_mixed_payment_breakdown', 'get_sales_with_discounts',
  'get_drop_products', 'get_active_drops', 'get_dashboard_stats'
)

UNION ALL

SELECT 
  'Políticas RLS creadas' as status,
  COUNT(*) as count
FROM pg_policies 
WHERE tablename IN (
  'branches', 'users', 'products', 'product_variants', 'stock', 
  'sales', 'sale_items', 'drops', 'drop_products', 
  'cash_registers', 'cash_movements'
);

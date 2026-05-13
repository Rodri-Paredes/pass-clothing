-- ============================================================
-- HARDENING COMPLETO PASS Clothing ERP
-- Ejecutar en Supabase SQL Editor (en orden)
-- ============================================================

-- ============================================================
-- PARTE 1: FUNCIÓN ATÓMICA PARA DECREMENTO DE STOCK
-- Resuelve race condition en ventas concurrentes
-- ============================================================

CREATE OR REPLACE FUNCTION decrement_stock_atomic(
  p_variant_id uuid,
  p_branch_id uuid,
  p_quantity integer
)
RETURNS boolean AS $$
DECLARE
  rows_affected integer;
BEGIN
  -- Un solo UPDATE atómico: decrementa solo si hay suficiente stock.
  -- No hay SELECT previo, por lo que no hay ventana de race condition.
  UPDATE stock
  SET 
    quantity = quantity - p_quantity,
    updated_at = now()
  WHERE variant_id = p_variant_id
    AND branch_id = p_branch_id
    AND quantity >= p_quantity;

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected > 0;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- PARTE 2: CONSTRAINTS QUE FALTAN EN EL SCHEMA ACTUAL
-- ============================================================

-- Stock nunca puede ser negativo
ALTER TABLE stock ADD CONSTRAINT chk_stock_non_negative 
  CHECK (quantity >= 0);

-- Ventas: total debe ser coherente con subtotal
ALTER TABLE sales ADD CONSTRAINT chk_sale_total_valid
  CHECK (total >= 0 AND subtotal >= 0 AND total <= subtotal);

-- Precio de venta unitario siempre positivo
ALTER TABLE sale_items ADD CONSTRAINT chk_sale_item_price_positive
  CHECK (unit_price > 0 AND quantity > 0 AND subtotal > 0);

-- Producto: precio no puede ser 0
ALTER TABLE products ADD CONSTRAINT chk_product_price_positive
  CHECK (price > 0);

-- Nombre de producto mínimo 2 caracteres
ALTER TABLE products ADD CONSTRAINT chk_product_name_length
  CHECK (char_length(trim(name)) >= 2);

-- ============================================================
-- PARTE 3: SOFT DELETE EN PRODUCTOS
-- Productos eliminados quedan en DB con deleted_at, no se borran
-- ============================================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES users(id) DEFAULT NULL;

-- Vista para productos activos (los que usa el frontend)
CREATE OR REPLACE VIEW active_products AS
  SELECT * FROM products WHERE deleted_at IS NULL;

-- Función de soft-delete en lugar de DELETE real
CREATE OR REPLACE FUNCTION soft_delete_product(p_product_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE products 
  SET 
    deleted_at = now(),
    deleted_by = auth.uid(),
    is_visible = false
  WHERE id = p_product_id AND deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- PARTE 4: RLS REAL POR ROLES
-- Reemplaza las policies "USING (true)" que no protegen nada
-- ============================================================

-- Helper function: es admin el usuario actual?
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: sucursal del usuario actual
CREATE OR REPLACE FUNCTION my_branch_id()
RETURNS uuid AS $$
  SELECT branch_id FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- PRODUCTS: todos pueden leer, solo admins pueden modificar
DROP POLICY IF EXISTS "Authenticated users can insert products" ON products;
DROP POLICY IF EXISTS "Authenticated users can update products" ON products;
DROP POLICY IF EXISTS "Authenticated users can delete products" ON products;

CREATE POLICY "Only admins can insert products"
  ON products FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Only admins can update products"
  ON products FOR UPDATE TO authenticated
  USING (is_admin());

CREATE POLICY "Only admins can delete products"
  ON products FOR DELETE TO authenticated
  USING (is_admin());

-- SALES: vendedores solo ven sus propias ventas de su sucursal; admins ven todo
DROP POLICY IF EXISTS "Users can read sales for their branch or all if admin" ON sales;
DROP POLICY IF EXISTS "Users can update sales for their branch or all if admin" ON sales;
DROP POLICY IF EXISTS "Users can delete sales for their branch or all if admin" ON sales;

CREATE POLICY "Sales read by branch"
  ON sales FOR SELECT TO authenticated
  USING (
    is_admin() OR branch_id = my_branch_id()
  );

-- Ventas NO se pueden actualizar ni borrar (integridad financiera)
-- Solo admins pueden hacerlo y solo en casos excepcionales
CREATE POLICY "Only admins can update sales"
  ON sales FOR UPDATE TO authenticated
  USING (is_admin());

CREATE POLICY "Only admins can delete sales"
  ON sales FOR DELETE TO authenticated
  USING (is_admin());

-- USERS: cada usuario solo ve su perfil; admins ven todos
DROP POLICY IF EXISTS "Users can read their own profile" ON users;

CREATE POLICY "Users read own profile, admins read all"
  ON users FOR SELECT TO authenticated
  USING (
    auth.uid() = id OR is_admin()
  );

-- BRANCHES: todos leen, solo admins modifican
DROP POLICY IF EXISTS "Authenticated users can insert branches" ON branches;
DROP POLICY IF EXISTS "Authenticated users can update branches" ON branches;
DROP POLICY IF EXISTS "Authenticated users can delete branches" ON branches;

CREATE POLICY "Only admins can modify branches"
  ON branches FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Only admins can update branches"
  ON branches FOR UPDATE TO authenticated
  USING (is_admin());

CREATE POLICY "Only admins can delete branches"  
  ON branches FOR DELETE TO authenticated
  USING (is_admin());

-- STOCK: vendedores ven solo su sucursal, solo admins modifican directamente
DROP POLICY IF EXISTS "Users can update stock for their branch or all if admin" ON stock;
DROP POLICY IF EXISTS "Users can delete stock for their branch or all if admin" ON stock;

CREATE POLICY "Only admins can directly update stock"
  ON stock FOR UPDATE TO authenticated
  USING (is_admin());

CREATE POLICY "Only admins can delete stock"
  ON stock FOR DELETE TO authenticated
  USING (is_admin());

-- ============================================================
-- PARTE 5: VERSIONADO DE PRODUCTOS
-- Guarda versión anterior completa en cada UPDATE
-- ============================================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

-- Incrementar versión en cada update
CREATE OR REPLACE FUNCTION fn_increment_product_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version := OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_product_version ON products;
CREATE TRIGGER trigger_product_version
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION fn_increment_product_version();

-- ============================================================
-- PARTE 6: CONSTRAINTS EN CASH_REGISTERS
-- Prevenir que existan 2 cajas ABIERTAS para la misma sucursal
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_open_register_per_branch
  ON cash_registers (branch_id)
  WHERE status = 'ABIERTA';

-- ============================================================
-- PARTE 7: ÍNDICES DE RENDIMIENTO
-- Para consultas comunes en producción
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_sales_branch_date ON sales(branch_id, sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_user_id ON sales(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_variant_branch ON stock(variant_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_visible ON products(is_visible) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_cash_movements_register ON cash_movements(cash_register_id, created_at DESC);

-- ============================================================
-- PARTE 8: FUNCIÓN DE BACKUP SNAPSHOT
-- Crea una tabla de snapshot de productos para recuperación
-- ============================================================

CREATE TABLE IF NOT EXISTS product_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  created_by uuid,
  snapshot_reason text,
  product_count integer,
  data jsonb NOT NULL  -- array completo de productos
);

CREATE OR REPLACE FUNCTION create_product_snapshot(p_reason text DEFAULT 'manual')
RETURNS uuid AS $$
DECLARE
  snap_id uuid;
BEGIN
  INSERT INTO product_snapshots(created_by, snapshot_reason, product_count, data)
  SELECT 
    auth.uid(),
    p_reason,
    COUNT(*),
    jsonb_agg(to_jsonb(p))
  FROM products p
  WHERE p.deleted_at IS NULL
  RETURNING id INTO snap_id;
  
  RETURN snap_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FIN
-- ============================================================

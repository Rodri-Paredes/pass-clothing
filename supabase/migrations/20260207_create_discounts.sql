-- =============================================
-- MIGRACIÓN: Sistema de Descuentos por Porcentaje
-- Fecha: 2026-02-07
-- =============================================

-- 1. Tabla principal de descuentos
CREATE TABLE IF NOT EXISTS discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  percentage NUMERIC(5,2) NOT NULL CHECK (percentage > 0 AND percentage <= 100),
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Validar que end_date > start_date
  CONSTRAINT chk_discount_dates CHECK (end_date > start_date)
);

-- 2. Tabla intermedia descuento-productos
CREATE TABLE IF NOT EXISTS discount_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_id UUID NOT NULL REFERENCES discounts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Un producto no puede estar dos veces en el mismo descuento
  CONSTRAINT uq_discount_product UNIQUE (discount_id, product_id)
);

-- 2b. Tabla intermedia descuento-drops
CREATE TABLE IF NOT EXISTS discount_drops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_id UUID NOT NULL REFERENCES discounts(id) ON DELETE CASCADE,
  drop_id UUID NOT NULL REFERENCES drops(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Un drop no puede estar dos veces en el mismo descuento
  CONSTRAINT uq_discount_drop UNIQUE (discount_id, drop_id)
);

-- 3. Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_discounts_active ON discounts(is_active, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_discounts_dates ON discounts(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_discount_products_discount ON discount_products(discount_id);
CREATE INDEX IF NOT EXISTS idx_discount_products_product ON discount_products(product_id);
CREATE INDEX IF NOT EXISTS idx_discount_drops_discount ON discount_drops(discount_id);
CREATE INDEX IF NOT EXISTS idx_discount_drops_drop ON discount_drops(drop_id);

-- 4. Función para verificar solapamiento de descuentos
-- Evita que un producto tenga dos descuentos activos en el mismo periodo
-- Considera descuentos directos al producto Y descuentos a través de drops
CREATE OR REPLACE FUNCTION check_discount_overlap()
RETURNS TRIGGER AS $$
DECLARE
  target_discount_start TIMESTAMPTZ;
  target_discount_end TIMESTAMPTZ;
  target_product_id UUID;
BEGIN
  -- Obtener las fechas del descuento objetivo
  SELECT start_date, end_date INTO target_discount_start, target_discount_end
  FROM discounts WHERE id = NEW.discount_id;

  -- Si es discount_products, verificar el producto directamente
  IF TG_TABLE_NAME = 'discount_products' THEN
    target_product_id := NEW.product_id;
    
    -- Verificar descuentos directos a este producto
    IF EXISTS (
      SELECT 1
      FROM discount_products dp
      JOIN discounts d ON d.id = dp.discount_id
      WHERE dp.product_id = target_product_id
        AND d.id != NEW.discount_id
        AND d.is_active = true
        AND d.start_date < target_discount_end
        AND d.end_date > target_discount_start
    ) THEN
      RAISE EXCEPTION 'El producto ya tiene un descuento activo que se solapa en el mismo periodo de tiempo';
    END IF;

    -- Verificar descuentos por drops que incluyan este producto
    IF EXISTS (
      SELECT 1
      FROM discount_drops dd
      JOIN discounts d ON d.id = dd.discount_id
      JOIN products p ON p.drop_id = dd.drop_id
      WHERE p.id = target_product_id
        AND d.id != NEW.discount_id
        AND d.is_active = true
        AND d.start_date < target_discount_end
        AND d.end_date > target_discount_start
    ) THEN
      RAISE EXCEPTION 'El producto ya tiene un descuento activo (a través de un drop) que se solapa en el mismo periodo';
    END IF;

  -- Si es discount_drops, verificar todos los productos del drop
  ELSIF TG_TABLE_NAME = 'discount_drops' THEN
    -- Verificar si algún producto del drop tiene descuento directo solapado
    IF EXISTS (
      SELECT 1
      FROM products p
      JOIN discount_products dp ON dp.product_id = p.id
      JOIN discounts d ON d.id = dp.discount_id
      WHERE p.drop_id = NEW.drop_id
        AND d.id != NEW.discount_id
        AND d.is_active = true
        AND d.start_date < target_discount_end
        AND d.end_date > target_discount_start
    ) THEN
      RAISE EXCEPTION 'Uno o más productos del drop ya tienen un descuento directo activo que se solapa';
    END IF;

    -- Verificar si el drop ya está en otro descuento solapado
    IF EXISTS (
      SELECT 1
      FROM discount_drops dd
      JOIN discounts d ON d.id = dd.discount_id
      WHERE dd.drop_id = NEW.drop_id
        AND d.id != NEW.discount_id
        AND d.is_active = true
        AND d.start_date < target_discount_end
        AND d.end_date > target_discount_start
    ) THEN
      RAISE EXCEPTION 'El drop ya tiene un descuento activo que se solapa en el mismo periodo de tiempo';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_discount_overlap_products
  BEFORE INSERT OR UPDATE ON discount_products
  FOR EACH ROW
  EXECUTE FUNCTION check_discount_overlap();

CREATE TRIGGER trg_check_discount_overlap_drops
  BEFORE INSERT OR UPDATE ON discount_drops
  FOR EACH ROW
  EXECUTE FUNCTION check_discount_overlap();

-- 5. Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_discount_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_discount_updated_at
  BEFORE UPDATE ON discounts
  FOR EACH ROW
  EXECUTE FUNCTION update_discount_updated_at();

-- 6. Vista para obtener productos con su descuento activo actual
-- Considera tanto descuentos directos como descuentos por drop
CREATE OR REPLACE VIEW products_with_active_discount AS
-- Descuentos directos al producto
SELECT
  p.id AS product_id,
  p.name AS product_name,
  p.price AS original_price,
  d.id AS discount_id,
  d.name AS discount_name,
  d.percentage,
  d.start_date,
  d.end_date,
  ROUND(p.price - (p.price * d.percentage / 100), 2) AS discounted_price,
  d.is_active,
  'product' AS discount_source
FROM products p
INNER JOIN discount_products dp ON dp.product_id = p.id
INNER JOIN discounts d ON d.id = dp.discount_id
WHERE d.is_active = true
  AND now() BETWEEN d.start_date AND d.end_date

UNION

-- Descuentos por drop
SELECT
  p.id AS product_id,
  p.name AS product_name,
  p.price AS original_price,
  d.id AS discount_id,
  d.name AS discount_name,
  d.percentage,
  d.start_date,
  d.end_date,
  ROUND(p.price - (p.price * d.percentage / 100), 2) AS discounted_price,
  d.is_active,
  'drop' AS discount_source
FROM products p
INNER JOIN discount_drops dd ON dd.drop_id = p.drop_id
INNER JOIN discounts d ON d.id = dd.discount_id
WHERE p.drop_id IS NOT NULL
  AND d.is_active = true
  AND now() BETWEEN d.start_date AND d.end_date;

-- 7. RLS Policies
ALTER TABLE discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_drops ENABLE ROW LEVEL SECURITY;

-- Política de lectura para todos los usuarios autenticados
CREATE POLICY "discounts_select_policy" ON discounts
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "discount_products_select_policy" ON discount_products
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "discount_drops_select_policy" ON discount_drops
  FOR SELECT TO authenticated
  USING (true);

-- Política de inserción/actualización/eliminación solo para admins
CREATE POLICY "discounts_insert_policy" ON discounts
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "discounts_update_policy" ON discounts
  FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "discounts_delete_policy" ON discounts
  FOR DELETE TO authenticated
  USING (true);

CREATE POLICY "discount_products_insert_policy" ON discount_products
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "discount_products_update_policy" ON discount_products
  FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "discount_products_delete_policy" ON discount_products
  FOR DELETE TO authenticated
  USING (true);

CREATE POLICY "discount_drops_insert_policy" ON discount_drops
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "discount_drops_update_policy" ON discount_drops
  FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "discount_drops_delete_policy" ON discount_drops
  FOR DELETE TO authenticated
  USING (true);

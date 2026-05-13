-- ============================================================
-- AUDIT LOG: Tabla + trigger para rastrear cambios en productos
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Tabla de auditoría de productos
CREATE TABLE IF NOT EXISTS product_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  operation text NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  changed_by uuid,              -- auth.uid() del usuario que hizo el cambio
  changed_at timestamptz NOT NULL DEFAULT now(),
  old_data jsonb,               -- snapshot ANTES del cambio
  new_data jsonb,               -- snapshot DESPUÉS del cambio
  changed_fields text[]         -- lista de columnas que cambiaron (solo para UPDATE)
);

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_product_audit_product_id ON product_audit_log(product_id);
CREATE INDEX IF NOT EXISTS idx_product_audit_changed_at ON product_audit_log(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_audit_changed_by ON product_audit_log(changed_by);

-- 2. Función del trigger de auditoría
CREATE OR REPLACE FUNCTION fn_audit_products()
RETURNS TRIGGER AS $$
DECLARE
  changed_cols text[] := ARRAY[]::text[];
  col_name text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO product_audit_log(product_id, operation, changed_by, new_data)
    VALUES (NEW.id, 'INSERT', auth.uid(), to_jsonb(NEW));
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Detectar qué columnas cambiaron
    FOR col_name IN
      SELECT key FROM jsonb_each(to_jsonb(NEW))
      WHERE to_jsonb(NEW)->key IS DISTINCT FROM to_jsonb(OLD)->key
    LOOP
      changed_cols := array_append(changed_cols, col_name);
    END LOOP;

    INSERT INTO product_audit_log(product_id, operation, changed_by, old_data, new_data, changed_fields)
    VALUES (NEW.id, 'UPDATE', auth.uid(), to_jsonb(OLD), to_jsonb(NEW), changed_cols);
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO product_audit_log(product_id, operation, changed_by, old_data)
    VALUES (OLD.id, 'DELETE', auth.uid(), to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Crear trigger (reemplazar si ya existe)
DROP TRIGGER IF EXISTS trigger_audit_products ON products;
CREATE TRIGGER trigger_audit_products
  AFTER INSERT OR UPDATE OR DELETE ON products
  FOR EACH ROW EXECUTE FUNCTION fn_audit_products();

-- 4. Tabla de auditoría de stock (rastrear cambios de stock)
CREATE TABLE IF NOT EXISTS stock_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id uuid NOT NULL,
  variant_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  operation text NOT NULL CHECK (operation IN ('INSERT', 'UPDATE')),
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  old_quantity integer,
  new_quantity integer,
  quantity_diff integer GENERATED ALWAYS AS (new_quantity - COALESCE(old_quantity, 0)) STORED
);

CREATE INDEX IF NOT EXISTS idx_stock_audit_variant_id ON stock_audit_log(variant_id);
CREATE INDEX IF NOT EXISTS idx_stock_audit_changed_at ON stock_audit_log(changed_at DESC);

-- 5. Función trigger de stock
CREATE OR REPLACE FUNCTION fn_audit_stock()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO stock_audit_log(stock_id, variant_id, branch_id, operation, changed_by, new_quantity)
    VALUES (NEW.id, NEW.variant_id, NEW.branch_id, 'INSERT', auth.uid(), NEW.quantity);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Solo loguear si la cantidad realmente cambió
    IF OLD.quantity IS DISTINCT FROM NEW.quantity THEN
      INSERT INTO stock_audit_log(stock_id, variant_id, branch_id, operation, changed_by, old_quantity, new_quantity)
      VALUES (NEW.id, NEW.variant_id, NEW.branch_id, 'UPDATE', auth.uid(), OLD.quantity, NEW.quantity);
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_audit_stock ON stock;
CREATE TRIGGER trigger_audit_stock
  AFTER INSERT OR UPDATE ON stock
  FOR EACH ROW EXECUTE FUNCTION fn_audit_stock();

-- 6. RLS: solo admins pueden leer el audit log
ALTER TABLE product_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins can read product_audit_log" ON product_audit_log;
CREATE POLICY "admins can read product_audit_log"
  ON product_audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "admins can read stock_audit_log" ON stock_audit_log;
CREATE POLICY "admins can read stock_audit_log"
  ON stock_audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 7. Función para ver historial de un producto específico
CREATE OR REPLACE FUNCTION get_product_history(p_product_id uuid)
RETURNS TABLE(
  operation text,
  changed_at timestamptz,
  user_name text,
  changed_fields text[],
  old_name text,
  new_name text,
  old_description text,
  new_description text,
  old_price decimal,
  new_price decimal
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pal.operation,
    pal.changed_at,
    COALESCE(u.name, 'Sistema') as user_name,
    pal.changed_fields,
    (pal.old_data->>'name')::text as old_name,
    (pal.new_data->>'name')::text as new_name,
    (pal.old_data->>'description')::text as old_description,
    (pal.new_data->>'description')::text as new_description,
    (pal.old_data->>'price')::decimal as old_price,
    (pal.new_data->>'price')::decimal as new_price
  FROM product_audit_log pal
  LEFT JOIN users u ON u.id = pal.changed_by
  WHERE pal.product_id = p_product_id
  ORDER BY pal.changed_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FIN - Si llegaste aquí sin errores, el audit log está activo
-- ============================================================

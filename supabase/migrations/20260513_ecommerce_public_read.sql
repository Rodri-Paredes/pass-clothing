-- ============================================================
-- FIX: Acceso de lectura público para el ecommerce
-- Fecha: 2026-05-13
--
-- PROBLEMA:
--   Todas las políticas SELECT en products, product_variants,
--   branches y stock son "TO authenticated". Los clientes del
--   ecommerce usan el rol `anon` → las tablas devuelven 0 filas
--   → producto aparece como "sin disponibilidad" aunque SÍ tenga
--   stock (ej. Tarija stock=14 pero muestra "no disponible").
--
-- FIX:
--   Agregar políticas SELECT para `anon` en las 4 tablas que
--   el ecommerce necesita leer para mostrar el catálogo y
--   disponibilidad por sucursal.
--
-- SEGURIDAD:
--   - Solo SELECT (lectura). Escribe sigue siendo authenticated.
--   - Solo tablas del catálogo público (productos, stock visible,
--     sucursales, variantes). NO aplica a sales, users, cash.
-- ============================================================

-- ── products ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public can read products" ON products;
CREATE POLICY "Public can read products"
  ON products FOR SELECT
  TO anon
  USING (true);

-- ── product_variants ─────────────────────────────────────────
DROP POLICY IF EXISTS "Public can read product variants" ON product_variants;
CREATE POLICY "Public can read product variants"
  ON product_variants FOR SELECT
  TO anon
  USING (true);

-- ── branches ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public can read branches" ON branches;
CREATE POLICY "Public can read branches"
  ON branches FOR SELECT
  TO anon
  USING (true);

-- ── stock ────────────────────────────────────────────────────
-- El ecommerce necesita leer stock por sucursal para mostrar
-- disponibilidad (ej. "Talla S: disponible en Tarija").
DROP POLICY IF EXISTS "Public can read stock levels" ON stock;
CREATE POLICY "Public can read stock levels"
  ON stock FOR SELECT
  TO anon
  USING (true);

-- ── Verificación ─────────────────────────────────────────────
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM pg_policies
  WHERE tablename IN ('products', 'product_variants', 'branches', 'stock')
    AND cmd = 'SELECT'
    AND roles @> ARRAY['anon'];
  
  IF v_count = 4 THEN
    RAISE NOTICE 'OK: 4 políticas SELECT para anon creadas correctamente.';
  ELSE
    RAISE WARNING 'REVISAR: Se esperaban 4 políticas anon SELECT, se encontraron %', v_count;
  END IF;
END;
$$;

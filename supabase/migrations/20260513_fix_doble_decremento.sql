-- ============================================================
-- DIAGNÓSTICO + FIX DEFINITIVO — DOBLE DECREMENTO DE STOCK
-- Fecha: 2026-05-13
-- Error: chk_stock_non_negative cuando SÍ hay stock disponible
--
-- ROOT CAUSE (confirmado por auditoría):
--
--   CAUSA #1 — TRIGGER ACTIVO en sale_items:
--     La migración 20250114_fix_stock_double_deduction.sql creó el trigger
--     trigger_reduce_stock_on_sale (AFTER INSERT ON sale_items).
--     Este trigger puede SEGUIR ACTIVO en producción.
--     Cuando create_sale_atomic inserta sale_items en el paso 4,
--     el trigger decrementa stock ANTES del paso 5 (decremento manual).
--     → Resultado: decremento doble → quantity negativo → CONSTRAINT VIOLATION
--
--   CAUSA #2 — create_sale_atomic sin guard en paso 5:
--     El UPDATE en el paso 5 es `quantity = quantity - v_qty` sin
--     `AND quantity >= v_qty`. Cualquier decremento previo (por trigger
--     o race condition) puede dejar quantity negativo.
--
-- FIX MÍNIMO (en orden de ejecución):
--   SECCIÓN A: Diagnóstico (solo lectura — ejecutar primero)
--   SECCIÓN B: Drops de triggers problemáticos
--   SECCIÓN C: Recrear create_sale_atomic con guard en paso 5
--   SECCIÓN D: Verificación post-fix
-- ============================================================


-- ============================================================
-- SECCIÓN A: DIAGNÓSTICO
-- Ejecutar primero — no modifica nada
-- ============================================================

-- A.1 ¿Qué triggers ACTIVOS existen en sales y sale_items?
SELECT
  tgrelid::regclass          AS tabla,
  tgname                     AS trigger_nombre,
  CASE tgenabled WHEN 'O' THEN 'ACTIVO' WHEN 'D' THEN 'DESACTIVADO' ELSE tgenabled::text END AS estado,
  pg_get_triggerdef(t.oid)   AS definicion
FROM pg_trigger t
WHERE tgrelid IN ('sales'::regclass, 'sale_items'::regclass)
  AND tgisinternal = false
ORDER BY tgrelid::regclass::text, tgname;

-- A.2 ¿create_sale_atomic existe en producción?
SELECT proname, prosecdef AS security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('create_sale_atomic', 'decrement_stock_atomic', 'register_sale_movement');

-- A.3 ¿Cuánto stock tienen los productos más vendidos ahora mismo?
SELECT
  p.name   AS producto,
  pv.size  AS talla,
  b.name   AS sucursal,
  s.quantity AS stock_actual
FROM stock s
JOIN product_variants pv ON pv.id = s.variant_id
JOIN products p ON p.id = pv.product_id
JOIN branches b ON b.id = s.branch_id
WHERE s.quantity >= 0
ORDER BY s.quantity ASC, p.name
LIMIT 30;

-- A.4 Últimas ventas con error (si tu DB tiene un log de errores)
-- Revisar si las ventas más recientes tienen items pero stock no fue decrementado
SELECT
  s.id       AS sale_id,
  s.branch_id,
  b.name     AS sucursal,
  s.created_at,
  SUM(si.quantity) AS items_qty,
  EXISTS (
    SELECT 1 FROM cash_movements cm WHERE cm.reference_id = s.id
  ) AS tiene_movimiento_caja
FROM sales s
JOIN branches b ON b.id = s.branch_id
LEFT JOIN sale_items si ON si.sale_id = s.id
WHERE s.created_at >= NOW() - INTERVAL '24 hours'
GROUP BY s.id, s.branch_id, b.name, s.created_at
ORDER BY s.created_at DESC;


-- ============================================================
-- SECCIÓN B: DROP DE TRIGGERS PROBLEMÁTICOS
-- Solo elimina triggers de stock — conserva trigger_register_sale_movement
-- ============================================================

-- Eliminar el trigger que causa doble decremento
DROP TRIGGER IF EXISTS trigger_reduce_stock_on_sale ON sale_items;
DROP TRIGGER IF EXISTS trigger_update_stock_on_sale ON sale_items;
DROP TRIGGER IF EXISTS trigger_decrease_stock       ON sale_items;
DROP TRIGGER IF EXISTS auto_reduce_stock            ON sale_items;
DROP TRIGGER IF EXISTS reduce_stock_after_sale      ON sale_items;
DROP TRIGGER IF EXISTS update_stock_after_sale      ON sale_items;

-- También en la tabla sales (por si acaso)
DROP TRIGGER IF EXISTS trigger_reduce_stock_on_sale ON sales;
DROP TRIGGER IF EXISTS auto_update_stock            ON sales;
DROP TRIGGER IF EXISTS trigger_decrease_stock       ON sales;

-- Verificar que trigger_register_sale_movement SÍ sigue activo
-- (es el que registra movimientos de caja — NO tocarlo)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trigger_register_sale_movement'
      AND tgrelid = 'sales'::regclass
      AND tgisinternal = false
  ) THEN
    RAISE WARNING
      'ATENCIÓN: trigger_register_sale_movement no encontrado en sales. '
      'Los movimientos de caja NO se registrarán automáticamente.';
  ELSE
    RAISE NOTICE 'OK: trigger_register_sale_movement activo en sales.';
  END IF;
END;
$$;

-- Limpiar funciones huérfanas de stock si existen
DROP FUNCTION IF EXISTS reduce_stock_on_sale()   CASCADE;
DROP FUNCTION IF EXISTS update_stock_on_sale()   CASCADE;
DROP FUNCTION IF EXISTS decrease_stock_on_sale() CASCADE;
DROP FUNCTION IF EXISTS auto_reduce_stock()      CASCADE;


-- ============================================================
-- SECCIÓN C: RECREAR create_sale_atomic CON SAFETY GUARD
-- Agrega AND quantity >= v_qty en el UPDATE del paso 5.
-- Esto garantiza que NUNCA puede violar chk_stock_non_negative.
-- SECURITY DEFINER para bypassear la RLS "Only admins can update stock".
-- ============================================================

CREATE OR REPLACE FUNCTION create_sale_atomic(
  p_branch_id       UUID,
  p_user_id         UUID,
  p_items           JSONB,
  p_payment_type    TEXT,
  p_subtotal        NUMERIC,
  p_discount_amount NUMERIC DEFAULT 0,
  p_total           NUMERIC DEFAULT 0,
  p_sale_date       TEXT    DEFAULT NULL,
  p_payment_details JSONB   DEFAULT NULL,
  p_notes           TEXT    DEFAULT NULL,
  p_sale_channel    TEXT    DEFAULT 'TIENDA'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sale_id      UUID;
  v_item         JSONB;
  v_variant      UUID;
  v_qty          INTEGER;
  v_price        NUMERIC;
  v_available    INTEGER;
  v_sale_date    TIMESTAMPTZ;
  v_result       JSONB;
  v_rows         INTEGER;
BEGIN
  -- ── 1. RESOLVER FECHA ─────────────────────────────────────
  IF p_sale_date IS NOT NULL THEN
    v_sale_date := p_sale_date::TIMESTAMPTZ;
  ELSE
    v_sale_date := NOW() AT TIME ZONE 'America/La_Paz';
  END IF;

  -- ── 2. VALIDAR Y BLOQUEAR STOCK (FOR UPDATE) ──────────────
  -- Bloqueo a nivel de fila previene race conditions concurrentes.
  -- Si otro proceso tiene el lock, esperamos hasta que libere y
  -- leemos el valor committed ANTES de validar.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_variant := (v_item->>'variantId')::UUID;
    v_qty     := (v_item->>'quantity')::INTEGER;

    SELECT quantity INTO v_available
    FROM stock
    WHERE variant_id = v_variant
      AND branch_id  = p_branch_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION
        'Sin registro de stock para variante % en esta sucursal. '
        'Verificar que el producto fue publicado en esta sucursal.',
        v_variant;
    END IF;

    IF v_available < v_qty THEN
      RAISE EXCEPTION
        'Stock insuficiente para la variante %. '
        'Disponible: %, Requerido: %',
        v_variant, v_available, v_qty;
    END IF;
  END LOOP;

  -- ── 3. INSERTAR VENTA ──────────────────────────────────────
  -- El trigger trigger_register_sale_movement se dispara aquí.
  -- Desde el fix de emergencia (20260513_emergency_fix_ventas.sql)
  -- el trigger es graceful (WARNING en lugar de EXCEPTION).
  INSERT INTO sales (
    user_id, branch_id, subtotal, discount_amount, total,
    sale_date, payment_type, payment_details, notes, sale_channel
  )
  VALUES (
    p_user_id, p_branch_id, p_subtotal, p_discount_amount, p_total,
    v_sale_date, p_payment_type, p_payment_details, p_notes, p_sale_channel
  )
  RETURNING id INTO v_sale_id;

  -- ── 4. INSERTAR ITEMS ──────────────────────────────────────
  -- NOTA: trigger_reduce_stock_on_sale fue eliminado en la Sección B.
  -- Ya NO se dispara ningún trigger de stock aquí.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_variant := (v_item->>'variantId')::UUID;
    v_qty     := (v_item->>'quantity')::INTEGER;
    v_price   := (v_item->>'unitPrice')::NUMERIC;

    INSERT INTO sale_items (sale_id, variant_id, quantity, unit_price, subtotal)
    VALUES (v_sale_id, v_variant, v_qty, v_price, v_qty * v_price);
  END LOOP;

  -- ── 5. DECREMENTAR STOCK (con safety guard) ────────────────
  -- Las filas ya están bloqueadas del paso 2.
  -- `AND quantity >= v_qty` es defensa en profundidad:
  -- garantiza que chk_stock_non_negative NUNCA puede ser violado
  -- ni por doble-decremento ni por cualquier otra condición.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_variant := (v_item->>'variantId')::UUID;
    v_qty     := (v_item->>'quantity')::INTEGER;

    UPDATE stock
    SET quantity   = quantity - v_qty,
        updated_at = NOW()
    WHERE variant_id = v_variant
      AND branch_id  = p_branch_id
      AND quantity   >= v_qty;   -- ← SAFETY GUARD: nunca negativo

    GET DIAGNOSTICS v_rows = ROW_COUNT;

    -- Si rows = 0 y el lock fue correcto, significa que entre el lock
    -- y el decremento el stock cambió (race condition extrema).
    -- Abortar con excepción clara.
    IF v_rows = 0 THEN
      RAISE EXCEPTION
        'No se pudo decrementar stock para variante % (branch %). '
        'Stock insuficiente al momento del commit. Intentar de nuevo.',
        v_variant, p_branch_id;
    END IF;
  END LOOP;

  -- ── 6. RETORNAR VENTA ──────────────────────────────────────
  SELECT jsonb_build_object(
    'id',              s.id,
    'user_id',         s.user_id,
    'branch_id',       s.branch_id,
    'subtotal',        s.subtotal,
    'discount_amount', s.discount_amount,
    'total',           s.total,
    'sale_date',       s.sale_date,
    'payment_type',    s.payment_type,
    'payment_details', s.payment_details,
    'notes',           s.notes,
    'sale_channel',    s.sale_channel,
    'created_at',      s.created_at
  )
  INTO v_result
  FROM sales s
  WHERE s.id = v_sale_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION create_sale_atomic(
  UUID, UUID, JSONB, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, JSONB, TEXT, TEXT
) TO authenticated;

DO $$ BEGIN RAISE NOTICE 'OK: create_sale_atomic recreada con safety guard en paso 5.'; END $$;


-- ============================================================
-- SECCIÓN D: VERIFICACIÓN POST-FIX
-- Ejecutar después de aplicar B y C — confirma que el fix está en orden
-- ============================================================

-- D.1 Confirmar que NO quedan triggers de stock en sale_items
SELECT
  tgrelid::regclass  AS tabla,
  tgname             AS trigger_nombre,
  CASE tgenabled WHEN 'O' THEN 'ACTIVO' WHEN 'D' THEN 'DESACTIVADO' ELSE tgenabled::text END AS estado
FROM pg_trigger t
WHERE tgrelid IN ('sales'::regclass, 'sale_items'::regclass)
  AND tgisinternal = false
  AND (
    tgname ILIKE '%stock%'
    OR tgname ILIKE '%reduce%'
    OR tgname ILIKE '%decrement%'
    OR tgname ILIKE '%inventory%'
  )
ORDER BY tgrelid::regclass::text, tgname;
-- ESPERADO: 0 filas. Si hay alguna, está causando el doble decremento.

-- D.2 Confirmar create_sale_atomic tiene SECURITY DEFINER
SELECT
  proname            AS funcion,
  prosecdef          AS security_definer,
  -- Confirmar guard en el código fuente
  prosrc ILIKE '%AND quantity   >= v_qty%' AS tiene_guard_en_paso_5
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('create_sale_atomic', 'decrement_stock_atomic');

-- D.3 Probar un decremento seguro manualmente:
-- Reemplazar los UUIDs con valores reales de tu DB antes de ejecutar.
-- DESCOMENTAR solo para prueba en desarrollo/staging.
/*
DO $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT create_sale_atomic(
    '8fb0375f-1572-40fb-9085-e836af8d5ae9'::UUID,  -- branch Cochabamba
    auth.uid(),
    '[{"variantId":"<UUID>","quantity":1,"unitPrice":100}]'::JSONB,
    'EFECTIVO', 100, 0, 100
  ) INTO v_result;
  RAISE NOTICE 'Test venta OK: %', v_result;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Test venta FALLO: %', SQLERRM;
END;
$$;
*/

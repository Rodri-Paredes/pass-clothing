-- ============================================================
-- EMERGENCY FIX — PRODUCCIÓN PASS Clothing ERP
-- Fecha: 2026-05-13
-- Prioridad: CRÍTICA
--
-- PROBLEMAS QUE RESUELVE:
--   1. decrement_stock_atomic sin SECURITY DEFINER
--      → vendedores bloqueados por RLS al decrementar stock
--      → Tarija: "stock insuficiente" aunque hay stock real
--
--   2. register_sale_movement lanza EXCEPTION dura si no hay
--      caja abierta → rollback de toda la venta
--      → Cochabamba: "no hay caja abierta" bloquea ventas
--
--   3. chk_sale_total_valid demasiado restrictivo
--      → podría bloquear ventas con flotantes o descuentos
--
--   4. DIAGNÓSTICO de orphaned sales y estado de cajas
--
-- INSTRUCCIONES:
--   1. Ejecutar SECCIÓN A (diagnóstico) primero → revisar resultados
--   2. Ejecutar SECCIÓN B (fix) → restaura ventas inmediatamente
--   3. Ejecutar SECCIÓN C (reconciliación) → corrige datos huérfanos
-- ============================================================


-- ============================================================
-- SECCIÓN A: DIAGNÓSTICO (SOLO LECTURA — ejecutar primero)
-- ============================================================

-- A.1 Estado actual de cajas por sucursal
SELECT
  b.id AS branch_id,
  b.name AS sucursal,
  cr.id AS cash_register_id,
  cr.status,
  cr.opening_date,
  -- ¿La caja tiene el branch_id correcto?
  CASE WHEN b.id = cr.branch_id THEN 'OK' ELSE 'MISMATCH!' END AS branch_match
FROM branches b
LEFT JOIN cash_registers cr ON cr.branch_id = b.id
ORDER BY b.name, cr.opening_date DESC;

-- A.2 Cajas abiertas en este momento
SELECT
  b.name AS sucursal,
  cr.id AS cash_register_id,
  cr.branch_id,
  cr.status,
  cr.opening_date
FROM cash_registers cr
JOIN branches b ON b.id = cr.branch_id
WHERE cr.status = 'ABIERTA';

-- A.3 Ventas huérfanas: ventas cuyo stock NUNCA fue decrementado
-- (existen en sales pero decrement_stock_atomic falló por RLS)
-- Heurística: ventas donde la suma de sale_items qty > stock disponible actualmente
WITH ventas_qty AS (
  SELECT
    si.variant_id,
    s.branch_id,
    s.created_at,
    SUM(si.quantity) AS qty_vendida
  FROM sale_items si
  JOIN sales s ON s.id = si.sale_id
  GROUP BY si.variant_id, s.branch_id, s.created_at
),
stock_actual AS (
  SELECT variant_id, branch_id, quantity AS qty_actual
  FROM stock
)
SELECT
  vq.variant_id,
  vq.branch_id,
  b.name AS sucursal,
  pv.size AS talla,
  p.name AS producto,
  vq.qty_vendida,
  sa.qty_actual,
  (vq.qty_vendida - sa.qty_actual) AS posible_deuda_stock
FROM ventas_qty vq
JOIN stock_actual sa ON sa.variant_id = vq.variant_id AND sa.branch_id = vq.branch_id
JOIN branches b ON b.id = vq.branch_id
JOIN product_variants pv ON pv.id = vq.variant_id
JOIN products p ON p.id = pv.product_id
WHERE vq.qty_vendida > sa.qty_actual
ORDER BY posible_deuda_stock DESC;

-- A.4 Contar ventas en los últimos 7 días con stock no decrementado
-- (si hay más ventas que decrementos, hay deuda)
SELECT
  s.branch_id,
  b.name AS sucursal,
  COUNT(s.id) AS total_ventas_recientes,
  SUM(si.quantity) AS total_items_vendidos
FROM sales s
JOIN branches b ON b.id = s.branch_id  
JOIN sale_items si ON si.sale_id = s.id
WHERE s.created_at >= NOW() - INTERVAL '7 days'
GROUP BY s.branch_id, b.name;


-- ============================================================
-- SECCIÓN B: FIX DE EMERGENCIA (RESTAURA VENTAS)
-- ============================================================
-- Ejecutar TODA esta sección de una vez.

-- ── FIX 1: Recrear decrement_stock_atomic CON SECURITY DEFINER ──
-- El problema: hardening añadió RLS "Only admins can update stock"
-- pero decrement_stock_atomic NO tiene SECURITY DEFINER.  
-- Con SECURITY DEFINER corre como su owner (postgres) y bypasea RLS.
-- La check AND quantity >= p_quantity asegura que nunca decrementa a negativo.
CREATE OR REPLACE FUNCTION decrement_stock_atomic(
  p_variant_id uuid,
  p_branch_id  uuid,
  p_quantity   integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER  -- ← CRÍTICO: bypasea RLS para que vendedores puedan decrementar
AS $$
DECLARE
  rows_affected integer;
BEGIN
  UPDATE stock
  SET
    quantity   = quantity - p_quantity,
    updated_at = now()
  WHERE variant_id = p_variant_id
    AND branch_id  = p_branch_id
    AND quantity   >= p_quantity;   -- nunca deja stock negativo

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION decrement_stock_atomic(uuid, uuid, integer) TO authenticated;

-- ── FIX 2: register_sale_movement — graceful si no hay caja abierta ──
-- El problema: lanza RAISE EXCEPTION dura → rollbackea TODA la venta.
-- Con el fix: emite WARNING y continúa.  La venta se registra igual.
-- El movimiento de caja se puede registrar manualmente si es necesario.
-- NOTA: esto NO elimina la obligación de tener caja abierta —
--       el frontend sigue mostrando el mensaje al usuario.
CREATE OR REPLACE FUNCTION register_sale_movement(p_sale_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sale_total       decimal(10,2);
  v_payment_type     text;
  v_user_id          uuid;
  v_branch_id        uuid;
  v_payment_details  jsonb;
  v_cash_register_id uuid;
  v_efectivo         decimal(10,2);
  v_qr               decimal(10,2);
  v_tarjeta          decimal(10,2);
BEGIN
  -- Obtener datos de la venta
  SELECT s.total, s.payment_type, s.user_id, s.branch_id, s.payment_details
  INTO v_sale_total, v_payment_type, v_user_id, v_branch_id, v_payment_details
  FROM sales s
  WHERE s.id = p_sale_id;

  IF NOT FOUND THEN
    RAISE WARNING 'register_sale_movement: venta % no encontrada', p_sale_id;
    RETURN;  -- salir gracefully
  END IF;

  -- Buscar caja abierta para esta sucursal
  SELECT id INTO v_cash_register_id
  FROM cash_registers
  WHERE branch_id = v_branch_id
    AND status    = 'ABIERTA';

  -- ── CAMBIO CRÍTICO: WARNING en vez de EXCEPTION ────────────
  -- Antes: RAISE EXCEPTION 'No hay caja abierta en esta sucursal'
  -- Ahora: emite warning y retorna — la venta NO se rollbackea
  IF v_cash_register_id IS NULL THEN
    RAISE WARNING
      'register_sale_movement: no hay caja abierta para branch_id=% (venta %). '
      'La venta se registró pero NO se generó movimiento de caja. '
      'Abrí la caja y reconciliá manualmente si es necesario.',
      v_branch_id, p_sale_id;
    RETURN;
  END IF;

  -- Registrar movimiento según tipo de pago
  IF v_payment_type = 'MIXTO' AND v_payment_details IS NOT NULL THEN
    v_efectivo := COALESCE((v_payment_details->>'efectivo')::decimal(10,2), 0);
    v_qr       := COALESCE((v_payment_details->>'qr')::decimal(10,2), 0);
    v_tarjeta  := COALESCE((v_payment_details->>'tarjeta')::decimal(10,2), 0);

    IF v_efectivo > 0 THEN
      INSERT INTO cash_movements (
        cash_register_id, movement_type, payment_type, amount,
        description, reference_id, reference_type, user_id
      ) VALUES (
        v_cash_register_id, 'INGRESO', 'EFECTIVO', v_efectivo,
        'Venta #' || substring(p_sale_id::text FROM 1 FOR 8),
        p_sale_id, 'SALE', v_user_id
      );
    END IF;

    IF v_qr > 0 THEN
      INSERT INTO cash_movements (
        cash_register_id, movement_type, payment_type, amount,
        description, reference_id, reference_type, user_id
      ) VALUES (
        v_cash_register_id, 'INGRESO', 'QR', v_qr,
        'Venta #' || substring(p_sale_id::text FROM 1 FOR 8),
        p_sale_id, 'SALE', v_user_id
      );
    END IF;

    IF v_tarjeta > 0 THEN
      INSERT INTO cash_movements (
        cash_register_id, movement_type, payment_type, amount,
        description, reference_id, reference_type, user_id
      ) VALUES (
        v_cash_register_id, 'INGRESO', 'TARJETA', v_tarjeta,
        'Venta #' || substring(p_sale_id::text FROM 1 FOR 8),
        p_sale_id, 'SALE', v_user_id
      );
    END IF;
  ELSE
    INSERT INTO cash_movements (
      cash_register_id, movement_type, payment_type, amount,
      description, reference_id, reference_type, user_id
    ) VALUES (
      v_cash_register_id, 'INGRESO', v_payment_type, v_sale_total,
      'Venta #' || substring(p_sale_id::text FROM 1 FOR 8),
      p_sale_id, 'SALE', v_user_id
    );
  END IF;
END;
$$;

-- ── FIX 3: Actualizar chk_sale_total_valid — tolerancia flotante ──
-- El constraint original "total <= subtotal" puede fallar si
-- discountAmount fuera negative por bug del frontend (total > subtotal).
-- Lo reemplazamos por uno más robusto.
ALTER TABLE sales DROP CONSTRAINT IF EXISTS chk_sale_total_valid;
ALTER TABLE sales ADD CONSTRAINT chk_sale_total_valid
  CHECK (
    total   >= 0
    AND subtotal >= 0
    AND discount_amount >= 0
    AND total <= subtotal + 0.01  -- 1 centavo de tolerancia para flotantes
  );

-- ── FIX 4: Asegurar que create_sale_atomic también tiene el GRANT ──
-- (En caso de que ya esté desplegado)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'create_sale_atomic'
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION create_sale_atomic(UUID,UUID,JSONB,TEXT,NUMERIC,NUMERIC,NUMERIC,TEXT,JSONB,TEXT,TEXT) TO authenticated';
    RAISE NOTICE 'GRANT aplicado a create_sale_atomic';
  ELSE
    RAISE NOTICE 'create_sale_atomic no existe aún — ok, el frontend usa fallback legacy';
  END IF;
END;
$$;


-- ============================================================
-- SECCIÓN C: RECONCILIACIÓN DE DATOS (ejecutar después de B)
-- ============================================================
-- Corra SOLO después de revisar diagnóstico A.3
-- Descuenta del stock las ventas recientes cuyo stock no fue decrementado
-- (orphaned sales de Tarija y otras sucursales).
--
-- IMPORTANTE: Este bloque es SEGURO (no puede dejar stock negativo).
-- Usa GREATEST(..., 0) para floor en 0.

-- C.1 Reconciliar stock de las últimas 24h donde decrement falló
-- (ventas creadas pero stock no decrementado por bug de RLS)
DO $$
DECLARE
  v_sale   RECORD;
  v_item   RECORD;
  v_current_qty integer;
BEGIN
  -- Obtener ventas SIN movimiento de caja de las últimas 48 horas
  -- (proxy para detectar ventas donde el flujo falló)
  FOR v_sale IN
    SELECT DISTINCT s.id, s.branch_id, s.created_at
    FROM sales s
    WHERE s.created_at >= NOW() - INTERVAL '48 hours'
      -- Ventas que no tienen movimiento de caja asociado
      AND NOT EXISTS (
        SELECT 1 FROM cash_movements cm WHERE cm.reference_id = s.id
      )
    ORDER BY s.created_at
  LOOP
    RAISE NOTICE 'Venta sin movimiento de caja: % (branch: %, creada: %)',
      v_sale.id, v_sale.branch_id, v_sale.created_at;
    -- No actualizamos stock automáticamente aquí para mayor seguridad
    -- Ver C.2 para la corrección de stock
  END LOOP;
END;
$$;

-- C.2 CORRECCIÓN MANUAL DE STOCK (ejecutar con cuidado)
-- Descuenta del stock las ventas de las últimas 48h que no tienen
-- movimiento de caja (probablemente orphaned sales).
-- REVISAR C.1 ANTES DE EJECUTAR ESTO.

/*
  ── DESCOMENTAR Y EJECUTAR SOLO SI C.1 listó ventas huérfanas ──

DO $$
DECLARE
  v_sale   RECORD;
  v_item   RECORD;
  v_rows   integer;
BEGIN
  FOR v_sale IN
    SELECT DISTINCT s.id, s.branch_id
    FROM sales s
    WHERE s.created_at >= NOW() - INTERVAL '48 hours'
      AND NOT EXISTS (
        SELECT 1 FROM cash_movements cm WHERE cm.reference_id = s.id
      )
  LOOP
    FOR v_item IN
      SELECT si.variant_id, si.quantity
      FROM sale_items si WHERE si.sale_id = v_sale.id
    LOOP
      UPDATE stock
      SET
        quantity   = GREATEST(quantity - v_item.quantity, 0),
        updated_at = NOW()
      WHERE variant_id = v_item.variant_id
        AND branch_id  = v_sale.branch_id;

      GET DIAGNOSTICS v_rows = ROW_COUNT;
      IF v_rows = 0 THEN
        RAISE WARNING 'Stock no encontrado: variant=% branch=%',
          v_item.variant_id, v_sale.branch_id;
      ELSE
        RAISE NOTICE 'Stock decrementado: variant=% branch=% qty=-%',
          v_item.variant_id, v_sale.branch_id, v_item.quantity;
      END IF;
    END LOOP;

    -- Registrar el movimiento de caja si hay caja abierta
    PERFORM register_sale_movement(v_sale.id);
    RAISE NOTICE 'Reconciliado: venta %', v_sale.id;
  END LOOP;
END;
$$;
*/


-- ============================================================
-- VERIFICACIÓN FINAL
-- ============================================================

-- Confirmar que decrement_stock_atomic ahora tiene SECURITY DEFINER
SELECT
  p.proname AS funcion,
  p.prosecdef AS security_definer,
  CASE WHEN p.prosecdef THEN '✓ OK — SECURITY DEFINER activo'
       ELSE '✗ FALTA SECURITY DEFINER'
  END AS estado
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('decrement_stock_atomic', 'create_sale_atomic', 'register_sale_movement')
ORDER BY p.proname;

-- Confirmar constraint corregido
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'sales'::regclass
  AND contype = 'c';

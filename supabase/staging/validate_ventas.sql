-- ============================================================
-- SCRIPT DE VALIDACIÓN COMPLETA — STAGING / PRE-DEPLOY
-- Ejecutar ANTES de cualquier deploy a producción.
-- Pasar todos los checks antes de proceder.
-- ============================================================
-- Instrucciones:
--   1. Conectarse a la DB de STAGING (nunca producción directa)
--   2. Ejecutar este archivo completo
--   3. Revisar resultados — todas las secciones deben pasar
--   4. Solo si pasan: ejecutar el mismo deploy en producción
-- ============================================================


-- ============================================================
-- CHECK 1: FUNCIONES CRÍTICAS EXISTEN Y TIENEN SECURITY DEFINER
-- ============================================================
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('create_sale_atomic', 'decrement_stock_atomic', 'register_sale_movement')
    AND p.prosecdef = true;

  IF v_count < 3 THEN
    RAISE EXCEPTION
      'CHECK 1 FALLO: Faltan funciones críticas o les falta SECURITY DEFINER. '
      'Encontradas con security_definer: %. Se requieren 3.', v_count;
  ELSE
    RAISE NOTICE 'CHECK 1 PASS: 3 funciones críticas con SECURITY DEFINER.';
  END IF;
END;
$$;


-- ============================================================
-- CHECK 2: NO HAY TRIGGERS DE STOCK EN sale_items
-- ============================================================
DO $$
DECLARE
  v_count integer;
  v_names text;
BEGIN
  SELECT COUNT(*), string_agg(tgname, ', ')
  INTO v_count, v_names
  FROM pg_trigger t
  WHERE tgrelid = 'sale_items'::regclass
    AND tgisinternal = false
    AND (
      tgname ILIKE '%stock%'
      OR tgname ILIKE '%reduce%'
      OR tgname ILIKE '%decrement%'
    );

  IF v_count > 0 THEN
    RAISE EXCEPTION
      'CHECK 2 FALLO: Triggers de stock activos en sale_items: %. '
      'Estos causan doble decremento. Ejecutar fix_doble_decremento.sql.', v_names;
  ELSE
    RAISE NOTICE 'CHECK 2 PASS: No hay triggers de stock en sale_items.';
  END IF;
END;
$$;


-- ============================================================
-- CHECK 3: trigger_register_sale_movement ACTIVO EN sales
-- ============================================================
DO $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger t
    WHERE tgrelid = 'sales'::regclass
      AND tgname = 'trigger_register_sale_movement'
      AND tgisinternal = false
      AND tgenabled = 'O'
  ) INTO v_exists;

  IF NOT v_exists THEN
    RAISE EXCEPTION
      'CHECK 3 FALLO: trigger_register_sale_movement no está activo en sales. '
      'Los movimientos de caja no se registrarán automáticamente.';
  ELSE
    RAISE NOTICE 'CHECK 3 PASS: trigger_register_sale_movement activo en sales.';
  END IF;
END;
$$;


-- ============================================================
-- CHECK 4: NO HAY STOCK NEGATIVO
-- ============================================================
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count FROM stock WHERE quantity < 0;

  IF v_count > 0 THEN
    RAISE EXCEPTION
      'CHECK 4 FALLO: % registros con stock negativo. '
      'Hay inconsistencia de datos. Revisar ventas recientes.', v_count;
  ELSE
    RAISE NOTICE 'CHECK 4 PASS: Todo el stock >= 0.';
  END IF;
END;
$$;


-- ============================================================
-- CHECK 5: NO HAY DOS CAJAS ABIERTAS EN LA MISMA SUCURSAL
-- ============================================================
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count FROM (
    SELECT branch_id FROM cash_registers WHERE status = 'ABIERTA'
    GROUP BY branch_id HAVING COUNT(*) > 1
  ) t;

  IF v_count > 0 THEN
    RAISE EXCEPTION
      'CHECK 5 FALLO: % sucursal(es) con más de una caja abierta. '
      'Cerrar la duplicada.', v_count;
  ELSE
    RAISE NOTICE 'CHECK 5 PASS: Una sola caja abierta por sucursal.';
  END IF;
END;
$$;


-- ============================================================
-- CHECK 6: CONSTRAINT chk_sale_total_valid TIENE TOLERANCIA FLOTANTE
-- ============================================================
DO $$
DECLARE
  v_constr text;
BEGIN
  SELECT pg_get_constraintdef(oid)
  INTO v_constr
  FROM pg_constraint
  WHERE conrelid = 'sales'::regclass
    AND conname = 'chk_sale_total_valid';

  IF v_constr IS NULL THEN
    RAISE NOTICE 'CHECK 6 INFO: Constraint chk_sale_total_valid no existe (puede ser OK).';
  ELSIF v_constr NOT LIKE '%0.01%' THEN
    RAISE EXCEPTION
      'CHECK 6 FALLO: chk_sale_total_valid sin tolerancia flotante: %. '
      'Ejecutar el fix de emergency_fix_ventas.sql.', v_constr;
  ELSE
    RAISE NOTICE 'CHECK 6 PASS: chk_sale_total_valid tiene tolerancia flotante.';
  END IF;
END;
$$;


-- ============================================================
-- CHECK 7: create_sale_atomic TIENE SAFETY GUARD en paso 5
-- ============================================================
DO $$
DECLARE
  v_src text;
BEGIN
  SELECT prosrc INTO v_src
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'create_sale_atomic';

  IF v_src IS NULL THEN
    RAISE NOTICE 'CHECK 7 SKIP: create_sale_atomic no existe (frontend usa fallback).';
  ELSIF v_src NOT LIKE '%>= v_qty%' THEN
    RAISE EXCEPTION
      'CHECK 7 FALLO: create_sale_atomic no tiene safety guard "AND quantity >= v_qty" en el UPDATE. '
      'Ejecutar fix_doble_decremento.sql.';
  ELSE
    RAISE NOTICE 'CHECK 7 PASS: create_sale_atomic tiene safety guard en paso 5.';
  END IF;
END;
$$;


-- ============================================================
-- CHECK 8: RLS HABILITADO EN TABLAS SENSIBLES
-- ============================================================
DO $$
DECLARE
  v_tables_without_rls text;
BEGIN
  SELECT string_agg(tablename, ', ')
  INTO v_tables_without_rls
  FROM pg_tables t
  WHERE schemaname = 'public'
    AND tablename IN ('sales', 'stock', 'products', 'users', 'cash_registers', 'cash_movements')
    AND NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = t.tablename
        AND c.relrowsecurity = true
    );

  IF v_tables_without_rls IS NOT NULL THEN
    RAISE EXCEPTION
      'CHECK 8 FALLO: RLS no habilitado en: %. '
      'Ejecutar hardening_completo.sql.', v_tables_without_rls;
  ELSE
    RAISE NOTICE 'CHECK 8 PASS: RLS habilitado en todas las tablas sensibles.';
  END IF;
END;
$$;


-- ============================================================
-- CHECK 9: VENTAS DE LAS ÚLTIMAS 24H NO DEJARON STOCK NEGATIVO
-- ============================================================
SELECT
  CASE WHEN COUNT(*) = 0
    THEN 'CHECK 9 PASS: Ninguna venta reciente dejó stock negativo'
    ELSE 'CHECK 9 FALLO: ' || COUNT(*) || ' variante(s) con stock negativo post-venta'
  END AS resultado
FROM stock s
WHERE s.quantity < 0
  AND EXISTS (
    SELECT 1 FROM sale_items si
    JOIN sales sv ON sv.id = si.sale_id
    WHERE si.variant_id = s.variant_id
      AND sv.branch_id = s.branch_id
      AND sv.created_at >= NOW() - INTERVAL '24 hours'
  );


-- ============================================================
-- CHECK 10: PERMISOS — authenticated puede ejecutar RPCs críticos
-- ============================================================
SELECT
  p.proname         AS funcion,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS puede_ejecutar
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('create_sale_atomic', 'decrement_stock_atomic', 'register_sale_movement',
                    'get_dashboard_stats', 'get_sales_with_discounts');
-- ESPERADO: todas las filas tienen puede_ejecutar = true


-- ============================================================
-- RESUMEN FINAL
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE '=================================================';
  RAISE NOTICE 'VALIDACIÓN COMPLETADA.';
  RAISE NOTICE 'Si llegaste aquí sin excepciones: TODO OK.';
  RAISE NOTICE 'Puedes proceder con el deploy a producción.';
  RAISE NOTICE '=================================================';
END;
$$;

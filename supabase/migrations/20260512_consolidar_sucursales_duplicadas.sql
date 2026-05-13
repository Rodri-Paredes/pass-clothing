-- ============================================================
-- AUDITORÍA Y CONSOLIDACIÓN DE SUCURSALES DUPLICADAS
-- Fecha: 2026-05-12
-- Propósito: Detectar, auditar y consolidar branches con el
--            mismo nombre en la base de datos PASS Clothing.
--
-- INSTRUCCIONES DE USO:
--   1. Ejecutar FASE 0–2 primero (solo lectura) para ver el diagnóstico.
--   2. Revisar los resultados antes de continuar.
--   3. Si hay duplicados, ejecutar FASE 3–6 dentro de una transacción.
--
-- NUNCA ejecutar todo junto sin revisar FASE 0–2 primero.
-- ============================================================

-- ============================================================
-- FASE 0: DIAGNÓSTICO GENERAL DE BRANCHES
-- ============================================================

-- 0.1 Ver TODAS las sucursales registradas
SELECT
  id,
  name,
  address,
  created_at,
  -- Marcar si hay duplicados por nombre
  COUNT(*) OVER (PARTITION BY name) AS total_con_mismo_nombre
FROM branches
ORDER BY name, created_at;

-- 0.2 Sucursales con nombre duplicado (foco del problema)
SELECT
  name,
  COUNT(*) AS cantidad_duplicadas,
  array_agg(id ORDER BY created_at) AS ids_en_orden_cronologico,
  array_agg(created_at ORDER BY created_at) AS fechas_creacion
FROM branches
GROUP BY name
HAVING COUNT(*) > 1;

-- ============================================================
-- FASE 1: CONTEO DE REGISTROS POR BRANCH EN CADA TABLA
-- ============================================================

-- 1.1 Stock por sucursal
SELECT
  b.id AS branch_id,
  b.name AS sucursal,
  b.created_at AS branch_creada,
  COUNT(s.id) AS total_stock_entries,
  SUM(s.quantity) AS total_unidades_en_stock,
  COUNT(CASE WHEN s.quantity > 0 THEN 1 END) AS variantes_con_stock
FROM branches b
LEFT JOIN stock s ON s.branch_id = b.id
GROUP BY b.id, b.name, b.created_at
ORDER BY b.name, b.created_at;

-- 1.2 Ventas por sucursal
SELECT
  b.id AS branch_id,
  b.name AS sucursal,
  b.created_at AS branch_creada,
  COUNT(sa.id) AS total_ventas,
  COALESCE(SUM(sa.total), 0) AS monto_total_ventas,
  MIN(sa.sale_date) AS primera_venta,
  MAX(sa.sale_date) AS ultima_venta
FROM branches b
LEFT JOIN sales sa ON sa.branch_id = b.id
GROUP BY b.id, b.name, b.created_at
ORDER BY b.name, b.created_at;

-- 1.3 Cajas (cash_registers) por sucursal
SELECT
  b.id AS branch_id,
  b.name AS sucursal,
  b.created_at AS branch_creada,
  COUNT(cr.id) AS total_cajas,
  COUNT(CASE WHEN cr.status = 'ABIERTA' THEN 1 END) AS cajas_abiertas,
  COUNT(CASE WHEN cr.status = 'CERRADA' THEN 1 END) AS cajas_cerradas,
  MIN(cr.opening_date) AS primera_apertura,
  MAX(cr.opening_date) AS ultima_apertura
FROM branches b
LEFT JOIN cash_registers cr ON cr.branch_id = b.id
GROUP BY b.id, b.name, b.created_at
ORDER BY b.name, b.created_at;

-- 1.4 Usuarios asignados por sucursal
SELECT
  b.id AS branch_id,
  b.name AS sucursal,
  b.created_at AS branch_creada,
  COUNT(u.id) AS total_usuarios,
  string_agg(u.name || ' (' || u.role || ')', ', ' ORDER BY u.name) AS usuarios
FROM branches b
LEFT JOIN users u ON u.branch_id = b.id
GROUP BY b.id, b.name, b.created_at
ORDER BY b.name, b.created_at;

-- 1.5 RESUMEN TOTAL: todas las tablas juntas para decidir qué mantener
WITH branch_data AS (
  SELECT
    b.id AS branch_id,
    b.name AS sucursal,
    b.created_at AS branch_creada,
    (SELECT COUNT(*) FROM stock WHERE branch_id = b.id) AS stock_entries,
    (SELECT COALESCE(SUM(quantity), 0) FROM stock WHERE branch_id = b.id) AS unidades_stock,
    (SELECT COUNT(*) FROM sales WHERE branch_id = b.id) AS ventas,
    (SELECT COUNT(*) FROM cash_registers WHERE branch_id = b.id) AS cajas,
    (SELECT COUNT(*) FROM users WHERE branch_id = b.id) AS usuarios
  FROM branches b
)
SELECT
  *,
  (stock_entries + ventas + cajas + usuarios) AS total_registros_relacionados,
  CASE
    WHEN ROW_NUMBER() OVER (PARTITION BY sucursal ORDER BY (stock_entries + ventas + cajas + usuarios) DESC, branch_creada ASC) = 1
    THEN '✓ MANTENER (más datos / más antigua)'
    ELSE '✗ CANDIDATO A ELIMINAR (menos datos)'
  END AS recomendacion
FROM branch_data
ORDER BY sucursal, (stock_entries + ventas + cajas + usuarios) DESC;

-- ============================================================
-- FASE 2: DETECTAR INCONSISTENCIAS
-- ============================================================

-- 2.1 ¿Hay movimientos de caja que pertenecen a cajas de sucursales duplicadas?
SELECT
  cr.id AS cash_register_id,
  b.id AS branch_id,
  b.name AS sucursal,
  cr.status,
  cr.opening_date,
  COUNT(cm.id) AS total_movimientos,
  COALESCE(SUM(cm.amount), 0) AS total_amount
FROM cash_registers cr
JOIN branches b ON b.id = cr.branch_id
LEFT JOIN cash_movements cm ON cm.cash_register_id = cr.id
WHERE b.name IN (SELECT name FROM branches GROUP BY name HAVING COUNT(*) > 1)
GROUP BY cr.id, b.id, b.name, cr.status, cr.opening_date
ORDER BY b.name, cr.opening_date;

-- 2.2 ¿Hay stock que fue cargado en la branch duplicada pero debería estar en la principal?
SELECT
  b.id AS branch_id,
  b.name AS sucursal,
  b.created_at AS branch_creada,
  COUNT(s.id) AS entradas_stock,
  SUM(s.quantity) AS unidades,
  string_agg(DISTINCT
    (SELECT p.name FROM products p JOIN product_variants pv ON pv.product_id = p.id WHERE pv.id = s.variant_id LIMIT 1)
    , ', ' ORDER BY (SELECT p.name FROM products p JOIN product_variants pv ON pv.product_id = p.id WHERE pv.id = s.variant_id LIMIT 1)
  ) AS productos_afectados
FROM branches b
JOIN stock s ON s.branch_id = b.id
WHERE b.name IN (SELECT name FROM branches GROUP BY name HAVING COUNT(*) > 1)
GROUP BY b.id, b.name, b.created_at
ORDER BY b.name;

-- ============================================================
-- FASE 3: CONSOLIDACIÓN TRANSACCIONAL
--
-- LEER TODO LO ANTERIOR ANTES DE EJECUTAR ESTA SECCIÓN.
--
-- Esta fase migra TODOS los datos de la branch duplicada
-- hacia la branch canónica (la más antigua / con más datos).
--
-- Para uso manual: reemplaza [ID_DUPLICADO] e [ID_CANONICO]
-- con los UUIDs reales detectados en FASE 1.
-- ============================================================

DO $$
DECLARE
  v_dup_id     uuid;
  v_canon_id   uuid;
  v_dup_name   text;
  n_stock      integer := 0;
  n_sales      integer := 0;
  n_cash_reg   integer := 0;
  n_users      integer := 0;
BEGIN
  -- --------------------------------------------------------
  -- BUCLE: procesar cada grupo de sucursales duplicadas
  -- --------------------------------------------------------
  FOR v_dup_name IN
    SELECT name FROM branches GROUP BY name HAVING COUNT(*) > 1
  LOOP
    RAISE NOTICE '=== Procesando duplicados para: % ===', v_dup_name;

    -- Seleccionar la branch CANÓNICA: la más antigua con mayor cantidad de datos
    SELECT id INTO v_canon_id
    FROM branches
    WHERE name = v_dup_name
    ORDER BY created_at ASC
    LIMIT 1;

    RAISE NOTICE 'Branch canónica (mantener): %', v_canon_id;

    -- Procesar cada branch duplicada (todas las demás con el mismo nombre)
    FOR v_dup_id IN
      SELECT id FROM branches
      WHERE name = v_dup_name AND id <> v_canon_id
    LOOP
      RAISE NOTICE 'Migrando branch duplicada % → %', v_dup_id, v_canon_id;

      -- -------------------------------------------------------
      -- 3.1 MIGRAR STOCK
      -- Merge: si ya existe (variant_id, canon_id), sumar quantities.
      --        Si no existe, simplemente reasignar branch_id.
      -- -------------------------------------------------------
      -- Primero: sumar el stock de la branch duplicada al registro existente
      UPDATE stock canon_s
      SET
        quantity = canon_s.quantity + dup_s.quantity,
        updated_at = now()
      FROM stock dup_s
      WHERE canon_s.variant_id = dup_s.variant_id
        AND canon_s.branch_id   = v_canon_id
        AND dup_s.branch_id     = v_dup_id;

      GET DIAGNOSTICS n_stock = ROW_COUNT;
      RAISE NOTICE '  Stock merged (sumado): % entradas', n_stock;

      -- Segundo: mover los registros que NO existían en la branch canónica
      UPDATE stock
      SET branch_id = v_canon_id, updated_at = now()
      WHERE branch_id = v_dup_id;

      GET DIAGNOSTICS n_stock = ROW_COUNT;
      RAISE NOTICE '  Stock reasignado: % entradas', n_stock;

      -- -------------------------------------------------------
      -- 3.2 MIGRAR VENTAS
      -- Sale history preservada intacta, solo se cambia el branch_id
      -- -------------------------------------------------------
      UPDATE sales
      SET branch_id = v_canon_id
      WHERE branch_id = v_dup_id;

      GET DIAGNOSTICS n_sales = ROW_COUNT;
      RAISE NOTICE '  Ventas reasignadas: %', n_sales;

      -- -------------------------------------------------------
      -- 3.3 MIGRAR CAJAS
      -- cash_registers reasignadas; cash_movements en cascada
      -- -------------------------------------------------------
      -- ANTES de mover: verificar si la branch canónica ya tiene caja ABIERTA
      -- Si la branch duplicada también tiene una ABIERTA, una debe cerrarse primero
      IF EXISTS (
        SELECT 1 FROM cash_registers
        WHERE branch_id = v_canon_id AND status = 'ABIERTA'
      ) AND EXISTS (
        SELECT 1 FROM cash_registers
        WHERE branch_id = v_dup_id AND status = 'ABIERTA'
      ) THEN
        RAISE WARNING '  CONFLICTO: ambas branches tienen caja ABIERTA. '
                      'Cerrando automáticamente la caja de la branch duplicada (%) '
                      'ya que la branch canónica (%) es la válida.',
                      v_dup_id, v_canon_id;

        UPDATE cash_registers
        SET
          status = 'CERRADA',
          closing_date = now(),
          closing_notes = 'Cerrada automáticamente durante consolidación de sucursales duplicadas. '
                          'Branch duplicada eliminada: ' || v_dup_id::text,
          updated_at = now()
        WHERE branch_id = v_dup_id AND status = 'ABIERTA';
      END IF;

      -- Mover todas las cajas (ABIERTA ya resuelta arriba si era conflicto)
      UPDATE cash_registers
      SET branch_id = v_canon_id, updated_at = now()
      WHERE branch_id = v_dup_id;

      GET DIAGNOSTICS n_cash_reg = ROW_COUNT;
      RAISE NOTICE '  Cajas reasignadas: %', n_cash_reg;

      -- -------------------------------------------------------
      -- 3.4 MIGRAR USUARIOS
      -- -------------------------------------------------------
      UPDATE users
      SET branch_id = v_canon_id
      WHERE branch_id = v_dup_id;

      GET DIAGNOSTICS n_users = ROW_COUNT;
      RAISE NOTICE '  Usuarios reasignados: %', n_users;

      -- -------------------------------------------------------
      -- 3.5 ELIMINAR LA BRANCH DUPLICADA (ya sin datos)
      -- Si aún hay FKs activas, el DELETE fallará de forma segura
      -- -------------------------------------------------------
      DELETE FROM branches WHERE id = v_dup_id;
      RAISE NOTICE '  Branch duplicada eliminada: %', v_dup_id;

    END LOOP; -- fin de cada duplicado

    RAISE NOTICE '=== Consolidación de "%" completada ===', v_dup_name;

  END LOOP; -- fin de cada grupo de duplicados

  RAISE NOTICE '';
  RAISE NOTICE '✓ CONSOLIDACIÓN FINALIZADA. Verificar con FASE 4 antes de hacer COMMIT.';
END;
$$;

-- ============================================================
-- FASE 4: VERIFICACIÓN POST-CONSOLIDACIÓN
-- Ejecutar después del DO $$ arriba para confirmar que todo quedó bien
-- ============================================================

-- 4.1 Confirmar que ya no hay sucursales duplicadas
SELECT
  name,
  COUNT(*) AS cantidad
FROM branches
GROUP BY name
ORDER BY name;
-- → Debe mostrar exactamente 1 por nombre

-- 4.2 Verificar integridad referencial: no debe haber registros
--     huérfanos apuntando a branches inexistentes
SELECT 'stock' AS tabla, COUNT(*) AS huerfanos
FROM stock WHERE branch_id NOT IN (SELECT id FROM branches)
UNION ALL
SELECT 'sales', COUNT(*)
FROM sales WHERE branch_id NOT IN (SELECT id FROM branches)
UNION ALL
SELECT 'cash_registers', COUNT(*)
FROM cash_registers WHERE branch_id NOT IN (SELECT id FROM branches)
UNION ALL
SELECT 'users', COUNT(*)
FROM users WHERE branch_id IS NOT NULL
  AND branch_id NOT IN (SELECT id FROM branches);
-- → Todos deben dar 0

-- 4.3 Confirmar totales finales por sucursal
SELECT
  b.id AS branch_id,
  b.name AS sucursal,
  b.created_at AS branch_creada,
  (SELECT COUNT(*) FROM stock WHERE branch_id = b.id) AS stock_entries,
  (SELECT COALESCE(SUM(quantity), 0) FROM stock WHERE branch_id = b.id) AS unidades_stock,
  (SELECT COUNT(*) FROM sales WHERE branch_id = b.id) AS ventas,
  (SELECT COUNT(*) FROM cash_registers WHERE branch_id = b.id) AS cajas,
  (SELECT COUNT(*) FROM users WHERE branch_id = b.id) AS usuarios
FROM branches b
ORDER BY b.name;

-- 4.4 Verificar cajas (solo debe haber 1 ABIERTA por sucursal)
SELECT
  b.name AS sucursal,
  cr.status,
  COUNT(*) AS cantidad,
  CASE WHEN cr.status = 'ABIERTA' AND COUNT(*) > 1
    THEN '⚠ PROBLEMA: más de 1 caja abierta'
    ELSE '✓ OK'
  END AS estado
FROM cash_registers cr
JOIN branches b ON b.id = cr.branch_id
GROUP BY b.name, cr.status
ORDER BY b.name, cr.status;

-- 4.5 Verificar stock sin conflictos de duplicados (variant+branch debe ser único)
SELECT
  variant_id,
  branch_id,
  COUNT(*) AS duplicados
FROM stock
GROUP BY variant_id, branch_id
HAVING COUNT(*) > 1;
-- → Debe devolver 0 filas

-- ============================================================
-- FASE 5: AGREGAR CONSTRAINT UNIQUE EN BRANCHES.NAME
-- Prevenir que vuelva a crearse una sucursal con nombre duplicado
-- ============================================================

-- Agregar constraint UNIQUE en name (después de confirmar que no hay duplicados)
ALTER TABLE branches
  ADD CONSTRAINT branches_name_unique UNIQUE (name);

-- Agregar constraint UNIQUE en address también (opcional pero recomendado)
-- ALTER TABLE branches
--   ADD CONSTRAINT branches_address_unique UNIQUE (address);

-- ============================================================
-- FASE 6: CHECKLIST DE VALIDACIÓN FINAL
-- ============================================================

-- 6.1 Listar todas las sucursales finales
SELECT id, name, address, created_at FROM branches ORDER BY name;

-- 6.2 Listar todas las cajas actualmente ABIERTAS
SELECT
  cr.id,
  b.name AS sucursal,
  cr.status,
  cr.opening_date,
  cr.opening_amount
FROM cash_registers cr
JOIN branches b ON b.id = cr.branch_id
WHERE cr.status = 'ABIERTA'
ORDER BY b.name;

-- 6.3 Distribución de stock por sucursal (resumen)
SELECT
  b.name AS sucursal,
  COUNT(s.id) AS variantes_con_stock,
  SUM(s.quantity) AS total_unidades
FROM branches b
LEFT JOIN stock s ON s.branch_id = b.id
GROUP BY b.name
ORDER BY b.name;

-- 6.4 Ventas por sucursal (resumen)
SELECT
  b.name AS sucursal,
  COUNT(sa.id) AS total_ventas,
  COALESCE(SUM(sa.total), 0)::numeric(10,2) AS monto_total
FROM branches b
LEFT JOIN sales sa ON sa.branch_id = b.id
GROUP BY b.name
ORDER BY b.name;

-- ============================================================
-- RESULTADO ESPERADO TRAS EJECUTAR CORRECTAMENTE:
--   ✓ Una sola entrada por nombre en branches
--   ✓ Todo el stock de Tarija bajo un único branch_id
--   ✓ Todas las ventas históricas preservadas
--   ✓ Cajas consolidadas (máximo 1 ABIERTA por sucursal)
--   ✓ Usuarios reasignados a branch canónica
--   ✓ UNIQUE constraint en branches.name activo
-- ============================================================

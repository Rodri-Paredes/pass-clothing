-- =====================================================
-- MIGRACIÓN: SOLUCIÓN DEFINITIVA PARA STOCK QUE SE REDUCE SOLO
-- =====================================================
-- Fecha: 2025-01-14
-- Problema: El stock se está reduciendo automáticamente (más de lo esperado)
-- Causa: Puede haber triggers automáticos duplicando la reducción de stock
-- Solución: Eliminar cualquier trigger automático y dejar solo el control manual

-- =====================================================
-- PASO 1: ELIMINAR TRIGGERS AUTOMÁTICOS DE STOCK
-- =====================================================

-- Eliminar triggers que puedan estar reduciendo stock automáticamente
DROP TRIGGER IF EXISTS trigger_reduce_stock_on_sale ON sale_items;
DROP TRIGGER IF EXISTS trigger_update_stock_on_sale ON sale_items;
DROP TRIGGER IF EXISTS trigger_decrease_stock ON sale_items;
DROP TRIGGER IF EXISTS auto_reduce_stock ON sale_items;
DROP TRIGGER IF EXISTS reduce_stock_after_sale ON sale_items;
DROP TRIGGER IF EXISTS update_stock_after_sale ON sale_items;

-- También verificar en la tabla sales
DROP TRIGGER IF EXISTS trigger_reduce_stock_on_sale ON sales;
DROP TRIGGER IF EXISTS auto_update_stock ON sales;

-- =====================================================
-- PASO 2: ELIMINAR FUNCIONES QUE YA NO SE USAN
-- =====================================================

DROP FUNCTION IF EXISTS reduce_stock_on_sale() CASCADE;
DROP FUNCTION IF EXISTS update_stock_on_sale() CASCADE;
DROP FUNCTION IF EXISTS decrease_stock_on_sale() CASCADE;
DROP FUNCTION IF EXISTS auto_reduce_stock() CASCADE;

-- =====================================================
-- PASO 3: MANTENER SOLO update_stock_safe PARA USO MANUAL
-- =====================================================
-- Esta función se usa desde el código de aplicación (salesService.ts)
-- NO la eliminamos porque es necesaria para las actualizaciones controladas

-- Verificar que la función update_stock_safe existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_stock_safe'
  ) THEN
    RAISE NOTICE 'Creando función update_stock_safe...';
    
    -- Crear la función si no existe
    CREATE OR REPLACE FUNCTION update_stock_safe(
      p_variant_id uuid,
      p_branch_id uuid,
      p_quantity integer
    )
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $func$
    DECLARE
      v_stock_id uuid;
      v_current_quantity integer;
    BEGIN
      -- Buscar si existe el registro de stock
      SELECT id, quantity INTO v_stock_id, v_current_quantity
      FROM stock
      WHERE variant_id = p_variant_id AND branch_id = p_branch_id
      FOR UPDATE; -- Bloquear la fila para evitar modificaciones concurrentes
      
      IF FOUND THEN
        -- Actualizar stock existente
        UPDATE stock 
        SET 
          quantity = p_quantity,
          updated_at = now()
        WHERE id = v_stock_id;
        
        -- Verificar que se actualizó correctamente
        IF NOT FOUND THEN
          RAISE EXCEPTION 'Error al actualizar stock: no se pudo modificar la fila';
        END IF;
        
        -- Verificar que la cantidad se guardó correctamente
        SELECT quantity INTO v_current_quantity
        FROM stock
        WHERE id = v_stock_id;
        
        IF v_current_quantity != p_quantity THEN
          RAISE EXCEPTION 'Error de integridad: cantidad esperada % pero se guardó %', p_quantity, v_current_quantity;
        END IF;
        
      ELSE
        -- Crear nuevo registro de stock
        INSERT INTO stock (variant_id, branch_id, quantity, created_at, updated_at)
        VALUES (p_variant_id, p_branch_id, p_quantity, now(), now());
        
        -- Verificar que se creó correctamente
        SELECT id, quantity INTO v_stock_id, v_current_quantity
        FROM stock
        WHERE variant_id = p_variant_id AND branch_id = p_branch_id;
        
        IF NOT FOUND THEN
          RAISE EXCEPTION 'Error al crear stock: no se pudo insertar la fila';
        END IF;
        
        IF v_current_quantity != p_quantity THEN
          RAISE EXCEPTION 'Error de integridad: cantidad esperada % pero se guardó %', p_quantity, v_current_quantity;
        END IF;
      END IF;
    END;
    $func$;
  ELSE
    RAISE NOTICE 'Función update_stock_safe ya existe - OK';
  END IF;
END $$;

-- =====================================================
-- PASO 4: VERIFICACIÓN FINAL
-- =====================================================

-- Verificar que NO queden triggers automáticos de stock
DO $$
DECLARE
  trigger_count integer;
BEGIN
  SELECT COUNT(*) INTO trigger_count
  FROM pg_trigger t
  JOIN pg_class c ON t.tgrelid = c.oid
  WHERE c.relname IN ('sale_items', 'sales', 'stock')
    AND t.tgisinternal = false
    AND (
      lower(t.tgname) LIKE '%stock%'
      OR lower(t.tgname) LIKE '%reduce%'
      OR lower(t.tgname) LIKE '%decrease%'
    );
  
  IF trigger_count > 0 THEN
    RAISE WARNING 'Advertencia: Se encontraron % triggers relacionados con stock. Revisa manualmente.', trigger_count;
  ELSE
    RAISE NOTICE '✅ Perfecto: No hay triggers automáticos de stock';
  END IF;
END $$;

-- Mostrar triggers activos (solo para información)
SELECT 
  t.tgname AS "Trigger",
  c.relname AS "Tabla",
  CASE t.tgtype::integer & 66 
    WHEN 2 THEN 'BEFORE' 
    WHEN 64 THEN 'INSTEAD OF'
    ELSE 'AFTER' 
  END AS "Momento",
  CASE 
    WHEN t.tgtype::integer & 4 <> 0 THEN 'INSERT'
    WHEN t.tgtype::integer & 8 <> 0 THEN 'DELETE'
    WHEN t.tgtype::integer & 16 <> 0 THEN 'UPDATE'
    ELSE 'TRUNCATE'
  END AS "Evento"
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relname IN ('sale_items', 'sales', 'stock')
  AND t.tgisinternal = false
ORDER BY c.relname, t.tgname;

-- =====================================================
-- RESULTADO
-- =====================================================
SELECT '✅ Migración completada exitosamente' AS status,
       'El stock ahora solo se controla desde el código de aplicación (salesService.ts)' AS descripcion;

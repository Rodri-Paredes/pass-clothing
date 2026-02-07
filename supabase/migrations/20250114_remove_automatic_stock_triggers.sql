-- MIGRACIÓN: ELIMINAR TRIGGERS AUTOMÁTICOS DE STOCK
-- Fecha: 2025-01-14
-- Problema: El stock se está restando automáticamente por triggers
-- Solución: Eliminar triggers y dejar que solo el código de aplicación maneje el stock

-- 1. ELIMINAR CUALQUIER TRIGGER QUE REDUZCA STOCK AUTOMÁTICAMENTE
DROP TRIGGER IF EXISTS trigger_reduce_stock_on_sale ON sale_items;
DROP TRIGGER IF EXISTS trigger_update_stock_on_sale ON sale_items;
DROP TRIGGER IF EXISTS trigger_decrease_stock ON sale_items;
DROP TRIGGER IF EXISTS auto_reduce_stock ON sale_items;

-- 2. ELIMINAR FUNCIONES RELACIONADAS QUE YA NO SE USAN
DROP FUNCTION IF EXISTS reduce_stock_on_sale();
DROP FUNCTION IF EXISTS update_stock_on_sale();
DROP FUNCTION IF EXISTS decrease_stock_on_sale();

-- 3. VERIFICAR QUE NO QUEDEN TRIGGERS ACTIVOS
SELECT 
  tgname AS "Trigger Activo",
  tgrelid::regclass AS "Tabla",
  pg_get_triggerdef(oid) AS "Definición"
FROM pg_trigger
WHERE tgrelid IN ('sale_items'::regclass, 'sales'::regclass)
  AND tgisinternal = false
  AND (
    pg_get_triggerdef(oid) ILIKE '%stock%'
    OR pg_get_triggerdef(oid) ILIKE '%quantity%'
  )
ORDER BY tgrelid::regclass::text, tgname;

-- 4. MENSAJE DE CONFIRMACIÓN
SELECT 'Triggers automáticos de stock eliminados exitosamente' AS status;

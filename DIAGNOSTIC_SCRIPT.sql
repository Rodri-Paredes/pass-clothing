-- SCRIPT DE DIAGNÓSTICO COMPLETO
-- Ejecuta este script para verificar que todo esté funcionando correctamente

-- 1. VERIFICAR TABLAS PRINCIPALES
SELECT 
  'Tables Check' as category,
  COUNT(CASE WHEN table_name = 'branches' THEN 1 END) as branches_table,
  COUNT(CASE WHEN table_name = 'users' THEN 1 END) as users_table,
  COUNT(CASE WHEN table_name = 'products' THEN 1 END) as products_table,
  COUNT(CASE WHEN table_name = 'sales' THEN 1 END) as sales_table,
  COUNT(CASE WHEN table_name = 'cash_registers' THEN 1 END) as cash_registers_table,
  COUNT(CASE WHEN table_name = 'cash_movements' THEN 1 END) as cash_movements_table
FROM information_schema.tables 
WHERE table_schema = 'public';

-- 2. VERIFICAR CONSTRAINT DE PAYMENT_TYPE EN SALES
SELECT 
  'Payment Type Constraint' as category,
  con.conname as constraint_name,
  pg_get_constraintdef(con.oid) as constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'sales' AND con.conname LIKE '%payment_type%';

-- 3. VERIFICAR FUNCIONES CRÍTICAS
SELECT 
  'Functions Check' as category,
  proname as function_name,
  pronargs as parameter_count,
  CASE 
    WHEN proname = 'sum_total_sales' AND pronargs = 3 THEN '✅ Correcto'
    WHEN proname = 'count_sales' AND pronargs = 2 THEN '✅ Correcto'
    WHEN proname = 'count_products_sold' AND pronargs = 2 THEN '✅ Correcto'
    WHEN proname = 'sum_total_sales_card' AND pronargs = 2 THEN '✅ Correcto'
    WHEN proname = 'open_cash_register' AND pronargs = 3 THEN '✅ Correcto'
    WHEN proname = 'close_cash_register' AND pronargs = 3 THEN '✅ Correcto'
    WHEN proname = 'get_open_cash_register' AND pronargs = 1 THEN '✅ Correcto'
    ELSE '⚠️ Revisar'
  END as status
FROM pg_proc 
WHERE proname IN (
  'sum_total_sales',
  'count_sales', 
  'count_products_sold',
  'sum_total_sales_card',
  'open_cash_register',
  'close_cash_register',
  'get_open_cash_register',
  'register_sale_movement',
  'get_cash_register_summary',
  'get_cash_movements',
  'get_cash_register_history'
)
ORDER BY proname;

-- 4. VERIFICAR COLUMNAS EN SALES
SELECT 
  'Sales Table Columns' as category,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'sales'
ORDER BY ordinal_position;

-- 5. VERIFICAR POLÍTICAS RLS
SELECT 
  'RLS Policies' as category,
  tablename,
  policyname,
  permissive,
  cmd as operation
FROM pg_policies 
WHERE tablename IN ('sales', 'cash_registers', 'cash_movements')
ORDER BY tablename, policyname;

-- 6. VERIFICAR ÍNDICES CRÍTICOS
SELECT 
  'Indexes Check' as category,
  indexname,
  tablename,
  indexdef
FROM pg_indexes 
WHERE tablename IN ('sales', 'cash_registers', 'cash_movements')
  AND indexname LIKE '%cash%' OR indexname LIKE '%payment%'
ORDER BY tablename;

-- 7. PRUEBA DE FUNCIONES (CON DATOS DE EJEMPLO)
-- Nota: Solo ejecutar si hay datos en la base

-- Obtener una sucursal de ejemplo
DO $$
DECLARE
  test_branch_id uuid;
  test_date date := CURRENT_DATE;
  result_total decimal(10,2);
  result_count integer;
BEGIN
  -- Obtener primera sucursal disponible
  SELECT id INTO test_branch_id FROM branches LIMIT 1;
  
  IF test_branch_id IS NOT NULL THEN
    -- Probar función sum_total_sales
    SELECT sum_total_sales(NULL, test_date, test_branch_id) INTO result_total;
    RAISE NOTICE 'sum_total_sales test: Branch %, Date %, Result: %', test_branch_id, test_date, result_total;
    
    -- Probar función count_sales
    SELECT count_sales(test_date, test_branch_id) INTO result_count;
    RAISE NOTICE 'count_sales test: Branch %, Date %, Result: %', test_branch_id, test_date, result_count;
    
    RAISE NOTICE 'Function tests completed successfully';
  ELSE
    RAISE NOTICE 'No branches found for testing';
  END IF;
END $$;

-- 8. RESUMEN FINAL
SELECT 
  'Final Status' as category,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cash_registers')
     AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'sum_total_sales' AND pronargs = 3)
     AND EXISTS (SELECT 1 FROM pg_constraint con JOIN pg_class rel ON rel.oid = con.conrelid 
                 WHERE rel.relname = 'sales' AND pg_get_constraintdef(con.oid) LIKE '%MIXTO%')
    THEN '✅ Todo correcto - Sistema listo'
    ELSE '⚠️ Hay problemas pendientes'
  END as system_status;


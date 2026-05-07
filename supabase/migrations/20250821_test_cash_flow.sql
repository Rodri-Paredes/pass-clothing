-- SCRIPT DE PRUEBA PARA VERIFICAR EL SISTEMA DE FLUJO DE CAJA
-- Ejecutar este script para probar que todo funciona correctamente

-- 1. VERIFICAR QUE LAS TABLAS EXISTEN Y TIENEN DATOS
SELECT 
  'cash_registers' as table_name,
  COUNT(*) as row_count,
  CASE WHEN COUNT(*) > 0 THEN 'OK' ELSE 'VACÍA' END as status
FROM cash_registers
UNION ALL
SELECT 
  'cash_movements' as table_name,
  COUNT(*) as row_count,
  CASE WHEN COUNT(*) > 0 THEN 'OK' ELSE 'VACÍA' END as status
FROM cash_movements;

-- 2. VERIFICAR QUE LAS FUNCIONES EXISTEN
SELECT 
  proname as function_name,
  CASE WHEN proname IS NOT NULL THEN 'EXISTE' ELSE 'NO EXISTE' END as status
FROM pg_proc 
WHERE proname IN (
  'open_cash_register',
  'close_cash_register', 
  'get_open_cash_register',
  'register_sale_movement',
  'get_cash_register_summary',
  'get_cash_movements',
  'get_cash_register_history'
);

-- 3. VERIFICAR POLÍTICAS RLS
SELECT 
  tablename,
  policyname,
  CASE WHEN policyname IS NOT NULL THEN 'ACTIVA' ELSE 'NO EXISTE' END as status
FROM pg_policies 
WHERE tablename IN ('cash_registers', 'cash_movements');

-- 4. PROBAR FUNCIÓN get_open_cash_register (debería devolver 0 filas si no hay caja abierta)
-- Reemplaza 'TU_BRANCH_ID_AQUI' con el ID real de tu sucursal
-- SELECT * FROM get_open_cash_register('TU_BRANCH_ID_AQUI');

-- 5. MOSTRAR ESTRUCTURA DE LAS TABLAS
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'cash_registers'
ORDER BY ordinal_position;

SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'cash_movements'
ORDER BY ordinal_position;




































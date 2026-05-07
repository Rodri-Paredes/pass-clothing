-- VERIFICACIÓN RÁPIDA DE LA MIGRACIÓN

-- 1. Verificar que la función existe
SELECT 
  proname as "Función",
  'OK ✓' as "Estado"
FROM pg_proc 
WHERE proname = 'update_cash_movements_on_payment_change';

-- 2. Verificar que el trigger existe
SELECT 
  trigger_name as "Trigger",
  event_object_table as "Tabla",
  'OK ✓' as "Estado"
FROM information_schema.triggers
WHERE trigger_name = 'trigger_update_payment_method';

-- 3. Verificar estructura de la tabla sales
SELECT 
  column_name as "Columna",
  data_type as "Tipo",
  'OK ✓' as "Estado"
FROM information_schema.columns
WHERE table_name = 'sales' 
  AND column_name IN ('payment_type', 'payment_details');

-- Si todo devuelve resultados, la migración se aplicó correctamente ✓

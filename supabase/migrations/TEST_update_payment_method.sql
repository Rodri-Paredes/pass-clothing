-- Script de prueba para la funcionalidad de editar método de pago
-- Este script verifica que la migración funcione correctamente

-- =====================================================
-- TEST 1: Verificar que la función existe
-- =====================================================
SELECT 
  proname as function_name,
  pg_get_functiondef(oid) as definition
FROM pg_proc 
WHERE proname = 'update_cash_movements_on_payment_change';

-- =====================================================
-- TEST 2: Verificar que el trigger existe
-- =====================================================
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trigger_update_payment_method';

-- =====================================================
-- TEST 3: Simular actualización de método de pago
-- =====================================================
-- NOTA: Este test requiere tener datos de prueba
-- Reemplaza los UUIDs con datos reales de tu base de datos

-- 3.1: Ver ventas existentes con sus métodos de pago
SELECT 
  id,
  branch_id,
  user_id,
  total,
  payment_type,
  payment_details,
  sale_date
FROM sales
ORDER BY created_at DESC
LIMIT 5;

-- 3.2: Ver cajas abiertas
SELECT 
  id,
  branch_id,
  status,
  opening_date,
  expected_cash,
  expected_qr,
  expected_card
FROM cash_registers
WHERE status = 'ABIERTA';

-- 3.3: Ver movimientos de caja existentes
SELECT 
  cm.id,
  cm.cash_register_id,
  cm.payment_type,
  cm.amount,
  cm.description,
  cm.reference_id,
  cm.created_at
FROM cash_movements cm
ORDER BY cm.created_at DESC
LIMIT 10;

-- =====================================================
-- TEST 4: Probar actualización (COMENTADO - descomentar para probar)
-- =====================================================
-- IMPORTANTE: Reemplaza '<SALE_ID>' con un ID de venta real

/*
-- 4.1: Ver estado inicial de la venta
SELECT 
  s.id,
  s.payment_type,
  s.payment_details,
  s.total,
  COUNT(cm.id) as num_cash_movements
FROM sales s
LEFT JOIN cash_movements cm ON cm.reference_id = s.id AND cm.reference_type = 'SALE'
WHERE s.id = '<SALE_ID>'
GROUP BY s.id, s.payment_type, s.payment_details, s.total;

-- 4.2: Actualizar método de pago (EFECTIVO a QR)
UPDATE sales 
SET payment_type = 'QR'
WHERE id = '<SALE_ID>';

-- 4.3: Verificar que se actualizó correctamente
SELECT 
  s.id,
  s.payment_type,
  s.payment_details,
  s.total,
  cm.payment_type as movement_payment_type,
  cm.amount,
  cm.description
FROM sales s
LEFT JOIN cash_movements cm ON cm.reference_id = s.id AND cm.reference_type = 'SALE'
WHERE s.id = '<SALE_ID>';

-- 4.4: Revertir cambio (opcional)
UPDATE sales 
SET payment_type = 'EFECTIVO'
WHERE id = '<SALE_ID>';
*/

-- =====================================================
-- TEST 5: Probar pago mixto (COMENTADO - descomentar para probar)
-- =====================================================
/*
-- 5.1: Actualizar a pago mixto
UPDATE sales 
SET 
  payment_type = 'MIXTO',
  payment_details = jsonb_build_object(
    'efectivo', 50,
    'qr', 30,
    'tarjeta', 20
  )
WHERE id = '<SALE_ID>';

-- 5.2: Verificar que se crearon 3 movimientos
SELECT 
  cm.payment_type,
  cm.amount,
  cm.description
FROM cash_movements cm
WHERE cm.reference_id = '<SALE_ID>' AND cm.reference_type = 'SALE'
ORDER BY cm.payment_type;
*/

-- =====================================================
-- TEST 6: Verificar integridad de datos
-- =====================================================
-- Este query verifica que la suma de movimientos coincida con el total de ventas
SELECT 
  s.id,
  s.total as sale_total,
  s.payment_type,
  SUM(cm.amount) as movements_total,
  s.total - COALESCE(SUM(cm.amount), 0) as difference
FROM sales s
LEFT JOIN cash_movements cm ON cm.reference_id = s.id AND cm.reference_type = 'SALE'
WHERE s.created_at >= NOW() - INTERVAL '7 days'
GROUP BY s.id, s.total, s.payment_type
HAVING ABS(s.total - COALESCE(SUM(cm.amount), 0)) > 0.01
ORDER BY s.created_at DESC;

-- =====================================================
-- Resultado esperado del TEST 6:
-- Si está todo correcto, no debería devolver ninguna fila
-- (o solo ventas que no tienen caja abierta)
-- =====================================================

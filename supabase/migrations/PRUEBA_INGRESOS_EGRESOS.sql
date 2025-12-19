-- ====================================================================================================
-- SCRIPT DE PRUEBA: Verificar que ingresos y egresos funcionen correctamente
-- ====================================================================================================
-- Instrucciones:
-- 1. Ejecuta este script DESPUÉS de aplicar la migración 20250118_fix_cash_movements_calculation.sql
-- 2. Revisa los resultados y verifica que los cálculos sean correctos
-- 3. Elimina los datos de prueba al final si lo deseas
-- ====================================================================================================

-- Paso 1: Obtener una sucursal de prueba
SELECT id, name FROM branches LIMIT 1;
-- Copia el ID de la sucursal

-- Paso 2: Abrir caja de prueba (reemplaza 'TU_BRANCH_ID' con el ID copiado)
SELECT open_cash_register(
  'TU_BRANCH_ID'::uuid,  -- Reemplaza con tu branch_id
  500.00,                -- Fondo inicial de $500
  'Prueba de ingresos y egresos'
);
-- Copia el ID de caja que retorna

-- Paso 3: Ver el resumen inicial (debería mostrar $500 en efectivo)
SELECT * FROM get_cash_register_summary('TU_CASH_REGISTER_ID'::uuid);
-- Reemplaza TU_CASH_REGISTER_ID con el ID de caja del paso anterior

-- Resultado esperado:
-- total_cash | total_qr | total_card | total_general | sales_count | opening_amount
-- 500.00     | 0.00     | 0.00       | 500.00        | 0           | 500.00


-- ====================================================================================================
-- Paso 4: Simular ventas (esto lo haría el sistema automáticamente)
-- ====================================================================================================

-- Venta 1: $300 en efectivo
INSERT INTO cash_movements (cash_register_id, movement_type, payment_type, amount, description, user_id)
VALUES (
  'TU_CASH_REGISTER_ID'::uuid,
  'INGRESO',
  'EFECTIVO',
  300.00,
  'Venta #1 - Efectivo',
  (SELECT id FROM users LIMIT 1)
);

-- Venta 2: $200 en QR
INSERT INTO cash_movements (cash_register_id, movement_type, payment_type, amount, description, user_id)
VALUES (
  'TU_CASH_REGISTER_ID'::uuid,
  'INGRESO',
  'QR',
  200.00,
  'Venta #2 - QR',
  (SELECT id FROM users LIMIT 1)
);

-- Ver resumen después de ventas
SELECT * FROM get_cash_register_summary('TU_CASH_REGISTER_ID'::uuid);
-- Resultado esperado:
-- total_cash | total_qr | total_card | total_general | sales_count | opening_amount
-- 800.00     | 200.00   | 0.00       | 1000.00       | 0           | 500.00
--  (500 + 300) (200)                    (500+300+200)


-- ====================================================================================================
-- Paso 5: REGISTRAR INGRESO MANUAL
-- ====================================================================================================

-- Ingreso: $150 de cambio traído de casa
INSERT INTO cash_movements (cash_register_id, movement_type, payment_type, amount, description, user_id)
VALUES (
  'TU_CASH_REGISTER_ID'::uuid,
  'INGRESO',
  'EFECTIVO',
  150.00,
  '✅ INGRESO MANUAL: Cambio traído de casa',
  (SELECT id FROM users LIMIT 1)
);

-- Ver resumen después del INGRESO
SELECT * FROM get_cash_register_summary('TU_CASH_REGISTER_ID'::uuid);
-- Resultado esperado:
-- total_cash | total_qr | total_card | total_general | sales_count | opening_amount
-- 950.00     | 200.00   | 0.00       | 1150.00       | 0           | 500.00
--   ^^^ DEBE AUMENTAR de 800 a 950 ✅


-- ====================================================================================================
-- Paso 6: REGISTRAR EGRESO MANUAL
-- ====================================================================================================

-- Egreso: $100 pagado a proveedor
INSERT INTO cash_movements (cash_register_id, movement_type, payment_type, amount, description, user_id)
VALUES (
  'TU_CASH_REGISTER_ID'::uuid,
  'EGRESO',
  'EFECTIVO',
  100.00,
  '❌ EGRESO MANUAL: Pago a proveedor Juan',
  (SELECT id FROM users LIMIT 1)
);

-- Ver resumen después del EGRESO
SELECT * FROM get_cash_register_summary('TU_CASH_REGISTER_ID'::uuid);
-- Resultado esperado:
-- total_cash | total_qr | total_card | total_general | sales_count | opening_amount
-- 850.00     | 200.00   | 0.00       | 1050.00       | 0           | 500.00
--   ^^^ DEBE DISMINUIR de 950 a 850 ✅


-- ====================================================================================================
-- Paso 7: OTRO EGRESO MANUAL
-- ====================================================================================================

-- Egreso: $200 retirados para depositar en banco
INSERT INTO cash_movements (cash_register_id, movement_type, payment_type, amount, description, user_id)
VALUES (
  'TU_CASH_REGISTER_ID'::uuid,
  'EGRESO',
  'EFECTIVO',
  200.00,
  '❌ EGRESO MANUAL: Retiro para depósito bancario',
  (SELECT id FROM users LIMIT 1)
);

-- Ver resumen final
SELECT * FROM get_cash_register_summary('TU_CASH_REGISTER_ID'::uuid);
-- Resultado esperado:
-- total_cash | total_qr | total_card | total_general | sales_count | opening_amount
-- 650.00     | 200.00   | 0.00       | 850.00        | 0           | 500.00
--   ^^^ DEBE DISMINUIR de 850 a 650 ✅


-- ====================================================================================================
-- Paso 8: VERIFICAR HISTORIAL DE MOVIMIENTOS
-- ====================================================================================================

SELECT 
  created_at,
  movement_type,
  payment_type,
  amount,
  description,
  CASE 
    WHEN movement_type = 'INGRESO' THEN '+' || amount::text
    WHEN movement_type = 'EGRESO' THEN '-' || amount::text
  END as efecto
FROM cash_movements
WHERE cash_register_id = 'TU_CASH_REGISTER_ID'::uuid
ORDER BY created_at;

-- Debe mostrar:
-- | created_at | movement_type | payment_type | amount | description                              | efecto  |
-- |------------|---------------|--------------|--------|------------------------------------------|---------|
-- | ...        | INGRESO       | EFECTIVO     | 500.00 | Apertura de caja - Fondo inicial         | +500.00 |
-- | ...        | INGRESO       | EFECTIVO     | 300.00 | Venta #1 - Efectivo                      | +300.00 |
-- | ...        | INGRESO       | QR           | 200.00 | Venta #2 - QR                            | +200.00 |
-- | ...        | INGRESO       | EFECTIVO     | 150.00 | ✅ INGRESO MANUAL: Cambio traído de casa | +150.00 |
-- | ...        | EGRESO        | EFECTIVO     | 100.00 | ❌ EGRESO MANUAL: Pago a proveedor       | -100.00 |
-- | ...        | EGRESO        | EFECTIVO     | 200.00 | ❌ EGRESO MANUAL: Retiro para banco      | -200.00 |


-- ====================================================================================================
-- Paso 9: PROBAR CIERRE DE CAJA
-- ====================================================================================================

-- Cerrar caja con $650 (el monto esperado)
SELECT close_cash_register(
  'TU_CASH_REGISTER_ID'::uuid,
  650.00,  -- Monto real en efectivo
  'Cierre de prueba - Todo correcto'
);

-- Ver los datos del cierre
SELECT 
  status,
  opening_amount,
  expected_cash,
  expected_qr,
  expected_card,
  expected_total,
  closing_amount,
  cash_difference,
  closing_notes
FROM cash_registers
WHERE id = 'TU_CASH_REGISTER_ID'::uuid;

-- Resultado esperado:
-- status  | opening_amount | expected_cash | expected_qr | expected_card | expected_total | closing_amount | cash_difference | closing_notes
-- CERRADA | 500.00         | 650.00        | 200.00      | 0.00          | 850.00         | 650.00         | 0.00            | Cierre de prueba...
--                            ^^^^^^                                                         ^^^^^^            ^^^^
--                          (calculado                                                    (ingresado)    (diferencia = 0)
--                           correctamente)


-- ====================================================================================================
-- DESGLOSE DEL CÁLCULO ESPERADO:
-- ====================================================================================================

/*
EFECTIVO:
  + Apertura:           $500
  + Venta #1:           $300
  + Ingreso manual #1:  $150
  - Egreso manual #1:   $100
  - Egreso manual #2:   $200
  ─────────────────────────
  = TOTAL EFECTIVO:     $650 ✅

QR:
  + Venta #2:           $200
  ─────────────────────────
  = TOTAL QR:           $200 ✅

TARJETA:
  (ninguna)
  ─────────────────────────
  = TOTAL TARJETA:      $0 ✅

TOTAL GENERAL:          $850 ✅
*/


-- ====================================================================================================
-- Paso 10: PRUEBA DE DIFERENCIA (FALTANTE)
-- ====================================================================================================

-- Abre otra caja y ciérrala con menos dinero del esperado
SELECT open_cash_register(
  'TU_BRANCH_ID'::uuid,
  500.00,
  'Segunda prueba - diferencia'
);
-- Guarda el nuevo cash_register_id

-- Simula una venta de $100
INSERT INTO cash_movements (cash_register_id, movement_type, payment_type, amount, description, user_id)
VALUES (
  'NUEVO_CASH_REGISTER_ID'::uuid,  -- Reemplaza
  'INGRESO',
  'EFECTIVO',
  100.00,
  'Venta de prueba',
  (SELECT id FROM users LIMIT 1)
);

-- El sistema espera: $500 + $100 = $600
-- Pero cierras con solo $550 (faltan $50)
SELECT close_cash_register(
  'NUEVO_CASH_REGISTER_ID'::uuid,
  550.00,
  'Prueba de faltante'
);

-- Ver la diferencia
SELECT expected_cash, closing_amount, cash_difference
FROM cash_registers
WHERE id = 'NUEVO_CASH_REGISTER_ID'::uuid;

-- Resultado esperado:
-- expected_cash | closing_amount | cash_difference
-- 600.00        | 550.00         | -50.00  ← NEGATIVO indica FALTANTE
--                                   ^^^^^^


-- ====================================================================================================
-- Paso 11: PRUEBA DE DIFERENCIA (SOBRANTE)
-- ====================================================================================================

-- Abre otra caja
SELECT open_cash_register(
  'TU_BRANCH_ID'::uuid,
  500.00,
  'Tercera prueba - sobrante'
);
-- Guarda el nuevo cash_register_id

-- Simula una venta de $100
INSERT INTO cash_movements (cash_register_id, movement_type, payment_type, amount, description, user_id)
VALUES (
  'TERCER_CASH_REGISTER_ID'::uuid,  -- Reemplaza
  'INGRESO',
  'EFECTIVO',
  100.00,
  'Venta de prueba',
  (SELECT id FROM users LIMIT 1)
);

-- El sistema espera: $500 + $100 = $600
-- Pero cierras con $650 (sobran $50)
SELECT close_cash_register(
  'TERCER_CASH_REGISTER_ID'::uuid,
  650.00,
  'Prueba de sobrante'
);

-- Ver la diferencia
SELECT expected_cash, closing_amount, cash_difference
FROM cash_registers
WHERE id = 'TERCER_CASH_REGISTER_ID'::uuid;

-- Resultado esperado:
-- expected_cash | closing_amount | cash_difference
-- 600.00        | 650.00         | 50.00  ← POSITIVO indica SOBRANTE
--                                  ^^^^^


-- ====================================================================================================
-- LIMPIEZA (OPCIONAL)
-- ====================================================================================================

-- Si quieres eliminar las pruebas:
/*
DELETE FROM cash_movements WHERE cash_register_id IN (
  'TU_CASH_REGISTER_ID',
  'NUEVO_CASH_REGISTER_ID',
  'TERCER_CASH_REGISTER_ID'
);

DELETE FROM cash_registers WHERE id IN (
  'TU_CASH_REGISTER_ID',
  'NUEVO_CASH_REGISTER_ID',
  'TERCER_CASH_REGISTER_ID'
);
*/


-- ====================================================================================================
-- ✅ CHECKLIST DE VERIFICACIÓN
-- ====================================================================================================

/*
[ ] El resumen inicial muestra correctamente el fondo de apertura
[ ] Después de un INGRESO manual, el total_cash AUMENTA
[ ] Después de un EGRESO manual, el total_cash DISMINUYE
[ ] El historial muestra todos los movimientos correctamente
[ ] Al cerrar con el monto exacto, cash_difference = 0
[ ] Al cerrar con menos dinero, cash_difference es negativo (faltante)
[ ] Al cerrar con más dinero, cash_difference es positivo (sobrante)
[ ] Los totales de QR y TARJETA no se afectan por movimientos de EFECTIVO
*/


-- ====================================================================================================
-- 📊 RESUMEN
-- ====================================================================================================

/*
Si todos los resultados esperados coinciden, ¡la corrección funciona perfectamente! ✅

AHORA:
- Los INGRESOS manuales SE SUMAN al efectivo
- Los EGRESOS manuales SE RESTAN del efectivo
- El cierre de caja calcula correctamente el efectivo esperado
- La diferencia se calcula bien (real - esperado)

El frontend no necesita cambios, solo consumir las funciones RPC actualizadas.
*/

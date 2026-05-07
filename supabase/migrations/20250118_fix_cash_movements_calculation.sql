-- ====================================================================================================
-- MIGRACIÓN: CORREGIR CÁLCULO DE EFECTIVO CONSIDERANDO INGRESOS Y EGRESOS
-- Fecha: 2025-01-18
-- Descripción: Los movimientos manuales (INGRESO/EGRESO) ahora afectan correctamente el efectivo total
-- ====================================================================================================

-- Eliminar funciones existentes primero
DROP FUNCTION IF EXISTS get_cash_register_summary(uuid);
DROP FUNCTION IF EXISTS close_cash_register(uuid, decimal, text);

-- Función corregida para resumen de caja
-- Ahora suma INGRESOS y resta EGRESOS para cada método de pago
CREATE OR REPLACE FUNCTION get_cash_register_summary(p_cash_register_id uuid)
RETURNS TABLE (
  total_cash decimal(10,2),
  total_qr decimal(10,2),
  total_card decimal(10,2),
  total_general decimal(10,2),
  sales_count integer,
  opening_amount decimal(10,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    -- EFECTIVO: suma ingresos - egresos
    COALESCE(
      SUM(CASE 
        WHEN cm.payment_type = 'EFECTIVO' AND cm.movement_type = 'INGRESO' THEN cm.amount
        WHEN cm.payment_type = 'EFECTIVO' AND cm.movement_type = 'EGRESO' THEN -cm.amount
        ELSE 0 
      END), 
    0) as total_cash,
    
    -- QR: suma ingresos - egresos
    COALESCE(
      SUM(CASE 
        WHEN cm.payment_type = 'QR' AND cm.movement_type = 'INGRESO' THEN cm.amount
        WHEN cm.payment_type = 'QR' AND cm.movement_type = 'EGRESO' THEN -cm.amount
        ELSE 0 
      END), 
    0) as total_qr,
    
    -- TARJETA: suma ingresos - egresos
    COALESCE(
      SUM(CASE 
        WHEN cm.payment_type = 'TARJETA' AND cm.movement_type = 'INGRESO' THEN cm.amount
        WHEN cm.payment_type = 'TARJETA' AND cm.movement_type = 'EGRESO' THEN -cm.amount
        ELSE 0 
      END), 
    0) as total_card,
    
    -- TOTAL GENERAL: suma de todos los ingresos - egresos
    COALESCE(
      SUM(CASE 
        WHEN cm.movement_type = 'INGRESO' THEN cm.amount
        WHEN cm.movement_type = 'EGRESO' THEN -cm.amount
        ELSE 0 
      END), 
    0) as total_general,
    
    -- Número de ventas (no se cuentan movimientos manuales)
    COUNT(DISTINCT CASE WHEN cm.reference_type = 'SALE' THEN cm.reference_id END)::integer as sales_count,
    
    -- Monto de apertura
    cr.opening_amount
  FROM cash_registers cr
  LEFT JOIN cash_movements cm ON cm.cash_register_id = cr.id
  WHERE cr.id = p_cash_register_id
  GROUP BY cr.opening_amount;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_cash_register_summary IS 'Obtiene el resumen de la caja considerando INGRESOS (+) y EGRESOS (-)';


-- Función corregida para cerrar caja
-- Ahora calcula el efectivo esperado considerando ingresos y egresos
CREATE OR REPLACE FUNCTION close_cash_register(
  p_cash_register_id uuid,
  p_closing_amount decimal(10,2),
  p_closing_notes text DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_user_id uuid;
  v_expected_cash decimal(10,2);
  v_expected_qr decimal(10,2);
  v_expected_card decimal(10,2);
  v_expected_total decimal(10,2);
  v_cash_difference decimal(10,2);
BEGIN
  SELECT id INTO v_user_id FROM users WHERE id = auth.uid();
  
  -- Calcular efectivo esperado: INGRESOS - EGRESOS
  SELECT 
    COALESCE(
      SUM(CASE 
        WHEN payment_type = 'EFECTIVO' AND movement_type = 'INGRESO' THEN amount
        WHEN payment_type = 'EFECTIVO' AND movement_type = 'EGRESO' THEN -amount
        ELSE 0 
      END), 
    0),
    COALESCE(
      SUM(CASE 
        WHEN payment_type = 'QR' AND movement_type = 'INGRESO' THEN amount
        WHEN payment_type = 'QR' AND movement_type = 'EGRESO' THEN -amount
        ELSE 0 
      END), 
    0),
    COALESCE(
      SUM(CASE 
        WHEN payment_type = 'TARJETA' AND movement_type = 'INGRESO' THEN amount
        WHEN payment_type = 'TARJETA' AND movement_type = 'EGRESO' THEN -amount
        ELSE 0 
      END), 
    0),
    COALESCE(
      SUM(CASE 
        WHEN movement_type = 'INGRESO' THEN amount
        WHEN movement_type = 'EGRESO' THEN -amount
        ELSE 0 
      END), 
    0)
  INTO v_expected_cash, v_expected_qr, v_expected_card, v_expected_total
  FROM cash_movements
  WHERE cash_register_id = p_cash_register_id;
  
  -- Calcular diferencia
  v_cash_difference := p_closing_amount - v_expected_cash;
  
  -- Actualizar caja con valores calculados
  UPDATE cash_registers SET
    status = 'CERRADA',
    closing_date = now(),
    closing_amount = p_closing_amount,
    closing_user_id = v_user_id,
    closing_notes = p_closing_notes,
    expected_cash = v_expected_cash,
    expected_qr = v_expected_qr,
    expected_card = v_expected_card,
    expected_total = v_expected_total,
    cash_difference = v_cash_difference
  WHERE id = p_cash_register_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION close_cash_register IS 'Cierra la caja calculando montos esperados con INGRESOS - EGRESOS';


-- ====================================================================================================
-- VERIFICACIÓN
-- ====================================================================================================

-- Consulta para verificar que las funciones se actualizaron correctamente
SELECT 
  routine_name,
  specific_name,
  last_altered
FROM information_schema.routines
WHERE routine_name IN ('get_cash_register_summary', 'close_cash_register')
ORDER BY routine_name;

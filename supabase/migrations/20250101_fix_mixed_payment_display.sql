-- Migración para corregir la visualización de pagos mixtos en el flujo de caja
-- Fecha: 2025-01-01
-- Descripción: Agrega función para agrupar movimientos de ventas mixtas

-- Función para obtener movimientos de caja agrupados por venta
CREATE OR REPLACE FUNCTION get_cash_movements_grouped(p_cash_register_id uuid)
RETURNS TABLE (
  id uuid,
  movement_type text,
  payment_type text,
  amount decimal(10,2),
  description text,
  reference_id uuid,
  reference_type text,
  user_name text,
  created_at timestamptz,
  total_amount decimal(10,2),
  is_grouped boolean
) AS $$
BEGIN
  RETURN QUERY
  WITH grouped_movements AS (
    SELECT 
      cm.reference_id,
      cm.reference_type,
      cm.movement_type,
      cm.user_id,
      cm.created_at,
      SUM(cm.amount) as total_amount,
      COUNT(*) as movement_count,
      MIN(cm.id) as first_id,
      MIN(cm.description) as description,
      MIN(u.name) as user_name
    FROM cash_movements cm
    JOIN users u ON u.id = cm.user_id
    WHERE cm.cash_register_id = p_cash_register_id
      AND cm.reference_type = 'SALE'
    GROUP BY cm.reference_id, cm.reference_type, cm.movement_type, cm.user_id, cm.created_at
    HAVING COUNT(*) > 1
  ),
  individual_movements AS (
    SELECT 
      cm.id,
      cm.movement_type,
      cm.payment_type,
      cm.amount,
      cm.description,
      cm.reference_id,
      cm.reference_type,
      u.name as user_name,
      cm.created_at,
      cm.amount as total_amount,
      false as is_grouped
    FROM cash_movements cm
    JOIN users u ON u.id = cm.user_id
    WHERE cm.cash_register_id = p_cash_register_id
      AND (cm.reference_type != 'SALE' OR cm.reference_id NOT IN (
        SELECT reference_id FROM grouped_movements
      ))
  )
  SELECT 
    COALESCE(gm.first_id, im.id) as id,
    im.movement_type,
    CASE 
      WHEN gm.reference_id IS NOT NULL THEN 'MIXTO'
      ELSE im.payment_type
    END as payment_type,
    im.amount,
    im.description,
    im.reference_id,
    im.reference_type,
    im.user_name,
    im.created_at,
    COALESCE(gm.total_amount, im.total_amount) as total_amount,
    COALESCE(gm.reference_id IS NOT NULL, im.is_grouped) as is_grouped
  FROM individual_movements im
  LEFT JOIN grouped_movements gm ON im.reference_id = gm.reference_id
  ORDER BY im.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentario sobre la función
COMMENT ON FUNCTION get_cash_movements_grouped IS 'Obtiene movimientos de caja agrupando ventas mixtas para mostrar el monto total correcto en el flujo de caja';


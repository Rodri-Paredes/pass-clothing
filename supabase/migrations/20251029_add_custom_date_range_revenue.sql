-- Migración para agregar reporte de ingresos por rango de fechas personalizado
-- Esta función permite seleccionar un rango de fechas específico para calcular ventas

-- Función para obtener el reporte de ingresos por rango de fechas personalizado
CREATE OR REPLACE FUNCTION get_date_range_revenue_report(
  branch_id_param uuid,
  start_date_param date,
  end_date_param date
)
RETURNS TABLE(
  start_date date,
  end_date date,
  total_revenue decimal(10,2),
  total_sales_count bigint,
  average_sale_amount decimal(10,2),
  revenue_by_payment_type jsonb,
  daily_revenue jsonb
) AS $$
DECLARE
  date_start date;
  date_end date;
BEGIN
  -- Asegurar que las fechas estén en el orden correcto
  IF start_date_param > end_date_param THEN
    date_start := end_date_param;
    date_end := start_date_param;
  ELSE
    date_start := start_date_param;
    date_end := end_date_param;
  END IF;

  RETURN QUERY
  WITH daily_sales AS (
    SELECT 
      (s.sale_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/La_Paz')::date as sale_day,
      SUM(s.total) as daily_total,
      COUNT(s.id) as daily_count
    FROM sales s
    WHERE s.branch_id = branch_id_param
      AND (s.sale_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/La_Paz')::date >= date_start
      AND (s.sale_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/La_Paz')::date <= date_end
    GROUP BY (s.sale_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/La_Paz')::date
    ORDER BY sale_day
  )
  SELECT 
    date_start as start_date,
    date_end as end_date,
    COALESCE(SUM(s.total), 0) as total_revenue,
    COUNT(s.id) as total_sales_count,
    CASE 
      WHEN COUNT(s.id) > 0 THEN COALESCE(SUM(s.total), 0) / COUNT(s.id)
      ELSE 0
    END as average_sale_amount,
    jsonb_build_object(
      'efectivo', COALESCE(SUM(CASE WHEN s.payment_type = 'EFECTIVO' THEN s.total ELSE 0 END), 0),
      'qr', COALESCE(SUM(CASE WHEN s.payment_type = 'QR' THEN s.total ELSE 0 END), 0),
      'tarjeta', COALESCE(SUM(CASE WHEN s.payment_type = 'TARJETA' THEN s.total ELSE 0 END), 0),
      'mixto', COALESCE(SUM(CASE WHEN s.payment_type = 'MIXTO' THEN s.total ELSE 0 END), 0)
    ) as revenue_by_payment_type,
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'date', sale_day,
          'total', daily_total,
          'count', daily_count
        ) ORDER BY sale_day
      )
      FROM daily_sales
    ) as daily_revenue
  FROM sales s
  WHERE s.branch_id = branch_id_param
    AND (s.sale_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/La_Paz')::date >= date_start
    AND (s.sale_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/La_Paz')::date <= date_end;
END;
$$ LANGUAGE plpgsql;

-- Crear comentario para documentar la función
COMMENT ON FUNCTION get_date_range_revenue_report IS 'Obtiene un reporte detallado de ingresos para un rango de fechas personalizado, incluyendo totales por tipo de pago y ventas diarias';

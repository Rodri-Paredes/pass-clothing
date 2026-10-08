-- El dashboard usa este reporte tanto para el mes actual como para los
-- rangos personalizados. Los pagos MIXTO se distribuyen por componente para
-- que Efectivo + QR + Tarjeta coincida con el total del período.

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
      AND (s.sale_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/La_Paz')::date BETWEEN date_start AND date_end
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
      'efectivo', COALESCE(SUM(CASE
        WHEN s.payment_type = 'EFECTIVO' THEN s.total
        WHEN s.payment_type = 'MIXTO' THEN COALESCE((s.payment_details->>'efectivo')::decimal(10,2), 0)
        ELSE 0
      END), 0),
      'qr', COALESCE(SUM(CASE
        WHEN s.payment_type = 'QR' THEN s.total
        WHEN s.payment_type = 'MIXTO' THEN COALESCE((s.payment_details->>'qr')::decimal(10,2), 0)
        ELSE 0
      END), 0),
      'tarjeta', COALESCE(SUM(CASE
        WHEN s.payment_type = 'TARJETA' THEN s.total
        WHEN s.payment_type = 'MIXTO' THEN COALESCE((s.payment_details->>'tarjeta')::decimal(10,2), 0)
        ELSE 0
      END), 0),
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
    AND (s.sale_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/La_Paz')::date BETWEEN date_start AND date_end;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_date_range_revenue_report(uuid, date, date) IS
  'Reporte por rango con totales de Efectivo, QR y Tarjeta; pagos mixtos distribuidos por componente.';

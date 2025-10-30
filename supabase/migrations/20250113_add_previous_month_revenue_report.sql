-- Migración para agregar reporte de ingresos del mes anterior (VERSIÓN CORREGIDA)
-- Este reporte calcula el total de ingresos del mes anterior para el dashboard

-- Función para obtener el reporte de ingresos del mes anterior
CREATE OR REPLACE FUNCTION get_previous_month_revenue_report(
  branch_id_param uuid
)
RETURNS TABLE(
  start_date date,
  end_date date,
  total_revenue decimal(10,2),
  total_sales_count integer,
  average_sale_amount decimal(10,2),
  revenue_by_payment_type jsonb
) AS $$
DECLARE
  prev_month_start date;
  prev_month_end date;
BEGIN
  -- Calcular el primer día del mes anterior
  prev_month_start := date_trunc('month', CURRENT_DATE - INTERVAL '1 month')::date;
  
  -- Calcular el último día del mes anterior
  prev_month_end := (date_trunc('month', CURRENT_DATE) - INTERVAL '1 day')::date;

  RETURN QUERY
  SELECT 
    prev_month_start as start_date,
    prev_month_end as end_date,
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
    ) as revenue_by_payment_type
  FROM sales s
  WHERE s.branch_id = branch_id_param
    AND (s.sale_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/La_Paz')::date >= prev_month_start
    AND (s.sale_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/La_Paz')::date <= prev_month_end;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener el reporte de ingresos de un mes específico
CREATE OR REPLACE FUNCTION get_monthly_revenue_report(
  branch_id_param uuid,
  year_param integer,
  month_param integer
)
RETURNS TABLE(
  start_date date,
  end_date date,
  total_revenue decimal(10,2),
  total_sales_count integer,
  average_sale_amount decimal(10,2),
  revenue_by_payment_type jsonb,
  daily_revenue jsonb
) AS $$
DECLARE
  month_start date;
  month_end date;
BEGIN
  -- Calcular el primer día del mes especificado
  month_start := make_date(year_param, month_param, 1);
  
  -- Calcular el último día del mes especificado
  month_end := (month_start + INTERVAL '1 month' - INTERVAL '1 day')::date;

  RETURN QUERY
  WITH daily_sales AS (
    SELECT 
      (s.sale_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/La_Paz')::date as sale_day,
      SUM(s.total) as daily_total,
      COUNT(s.id) as daily_count
    FROM sales s
    WHERE s.branch_id = branch_id_param
      AND (s.sale_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/La_Paz')::date >= month_start
      AND (s.sale_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/La_Paz')::date <= month_end
    GROUP BY (s.sale_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/La_Paz')::date
    ORDER BY sale_day
  )
  SELECT 
    month_start as start_date,
    month_end as end_date,
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
        )
      )
      FROM daily_sales
    ) as daily_revenue
  FROM sales s
  WHERE s.branch_id = branch_id_param
    AND (s.sale_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/La_Paz')::date >= month_start
    AND (s.sale_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/La_Paz')::date <= month_end;
END;
$$ LANGUAGE plpgsql;

-- Función para comparar ingresos entre el mes actual y el anterior
CREATE OR REPLACE FUNCTION get_monthly_revenue_comparison(
  branch_id_param uuid
)
RETURNS TABLE(
  current_month_start date,
  current_month_end date,
  current_month_revenue decimal(10,2),
  current_month_sales_count integer,
  previous_month_start date,
  previous_month_end date,
  previous_month_revenue decimal(10,2),
  previous_month_sales_count integer,
  revenue_change decimal(10,2),
  revenue_change_percentage decimal(5,2),
  sales_count_change integer,
  sales_count_change_percentage decimal(5,2)
) AS $$
DECLARE
  current_month_start date;
  current_month_end date;
  previous_month_start date;
  previous_month_end date;
  current_revenue decimal(10,2);
  previous_revenue decimal(10,2);
  current_count integer;
  previous_count integer;
BEGIN
  -- Calcular fechas del mes actual
  current_month_start := date_trunc('month', CURRENT_DATE)::date;
  current_month_end := (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::date;
  
  -- Calcular fechas del mes anterior
  previous_month_start := date_trunc('month', CURRENT_DATE - INTERVAL '1 month')::date;
  previous_month_end := (date_trunc('month', CURRENT_DATE) - INTERVAL '1 day')::date;

  -- Obtener ingresos del mes actual
  SELECT 
    COALESCE(SUM(total), 0),
    COUNT(id)
  INTO current_revenue, current_count
  FROM sales
  WHERE branch_id = branch_id_param
    AND (sale_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/La_Paz')::date >= current_month_start
    AND (sale_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/La_Paz')::date <= current_month_end;

  -- Obtener ingresos del mes anterior
  SELECT 
    COALESCE(SUM(total), 0),
    COUNT(id)
  INTO previous_revenue, previous_count
  FROM sales
  WHERE branch_id = branch_id_param
    AND (sale_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/La_Paz')::date >= previous_month_start
    AND (sale_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/La_Paz')::date <= previous_month_end;

  RETURN QUERY
  SELECT 
    current_month_start,
    current_month_end,
    current_revenue,
    current_count,
    previous_month_start,
    previous_month_end,
    previous_revenue,
    previous_count,
    (current_revenue - previous_revenue) as revenue_change,
    CASE 
      WHEN previous_revenue > 0 THEN ((current_revenue - previous_revenue) / previous_revenue * 100)
      WHEN current_revenue > 0 THEN 100.00
      ELSE 0.00
    END as revenue_change_percentage,
    (current_count - previous_count) as sales_count_change,
    CASE 
      WHEN previous_count > 0 THEN ((current_count - previous_count)::decimal / previous_count * 100)
      WHEN current_count > 0 THEN 100.00
      ELSE 0.00
    END as sales_count_change_percentage;
END;
$$ LANGUAGE plpgsql;

-- Crear comentarios para documentar las funciones
COMMENT ON FUNCTION get_previous_month_revenue_report(uuid) IS 'Obtiene el reporte completo de ingresos del mes anterior para una sucursal específica';
COMMENT ON FUNCTION get_monthly_revenue_report(uuid, integer, integer) IS 'Obtiene el reporte completo de ingresos de un mes específico para una sucursal';
COMMENT ON FUNCTION get_monthly_revenue_comparison(uuid) IS 'Compara los ingresos del mes actual con el mes anterior, incluyendo porcentajes de cambio';

-- Crear índice simple para consultas por tipo de pago
CREATE INDEX IF NOT EXISTS idx_sales_branch_payment_type ON sales (branch_id, payment_type);

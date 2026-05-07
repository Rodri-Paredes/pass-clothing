-- Corrección: Desglosar correctamente los pagos mixtos en TODAS las funciones de reporte
-- Los pagos mixtos deben sumar sus componentes (efectivo/qr/tarjeta) a cada categoría
-- Esto asegura que: Efectivo + QR + Tarjeta = Total Ingresos

-- Primero eliminamos las funciones existentes
DROP FUNCTION IF EXISTS get_date_range_revenue_report(uuid, date, date);
DROP FUNCTION IF EXISTS get_monthly_revenue_report(uuid, integer, integer);
DROP FUNCTION IF EXISTS get_previous_month_revenue_report(uuid);

-- ============================================
-- 1. Función get_date_range_revenue_report
-- ============================================
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
      'efectivo', COALESCE(
        SUM(CASE WHEN s.payment_type = 'EFECTIVO' THEN s.total ELSE 0 END) +
        SUM(CASE WHEN s.payment_type = 'MIXTO' THEN COALESCE((s.payment_details->>'efectivo')::decimal, 0) ELSE 0 END),
        0
      ),
      'qr', COALESCE(
        SUM(CASE WHEN s.payment_type = 'QR' THEN s.total ELSE 0 END) +
        SUM(CASE WHEN s.payment_type = 'MIXTO' THEN COALESCE((s.payment_details->>'qr')::decimal, 0) ELSE 0 END),
        0
      ),
      'tarjeta', COALESCE(
        SUM(CASE WHEN s.payment_type = 'TARJETA' THEN s.total ELSE 0 END) +
        SUM(CASE WHEN s.payment_type = 'MIXTO' THEN COALESCE((s.payment_details->>'tarjeta')::decimal, 0) ELSE 0 END),
        0
      ),
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

COMMENT ON FUNCTION get_date_range_revenue_report IS 'Obtiene un reporte detallado de ingresos para un rango de fechas personalizado. Los pagos mixtos se desglosan en sus componentes (efectivo/qr/tarjeta) y se suman a cada categoría correspondiente.';

-- ============================================
-- 2. Función get_monthly_revenue_report
-- ============================================
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
  month_start := make_date(year_param, month_param, 1);
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
      'efectivo', COALESCE(
        SUM(CASE WHEN s.payment_type = 'EFECTIVO' THEN s.total ELSE 0 END) +
        SUM(CASE WHEN s.payment_type = 'MIXTO' THEN COALESCE((s.payment_details->>'efectivo')::decimal, 0) ELSE 0 END),
        0
      ),
      'qr', COALESCE(
        SUM(CASE WHEN s.payment_type = 'QR' THEN s.total ELSE 0 END) +
        SUM(CASE WHEN s.payment_type = 'MIXTO' THEN COALESCE((s.payment_details->>'qr')::decimal, 0) ELSE 0 END),
        0
      ),
      'tarjeta', COALESCE(
        SUM(CASE WHEN s.payment_type = 'TARJETA' THEN s.total ELSE 0 END) +
        SUM(CASE WHEN s.payment_type = 'MIXTO' THEN COALESCE((s.payment_details->>'tarjeta')::decimal, 0) ELSE 0 END),
        0
      ),
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

COMMENT ON FUNCTION get_monthly_revenue_report IS 'Obtiene el reporte completo de ingresos de un mes específico. Los pagos mixtos se desglosan en sus componentes.';

-- ============================================
-- 3. Función get_previous_month_revenue_report
-- ============================================
CREATE OR REPLACE FUNCTION get_previous_month_revenue_report(
  branch_id_param uuid
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
  month_start := (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')::date;
  month_end := (date_trunc('month', CURRENT_DATE) - INTERVAL '1 day')::date;

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
      'efectivo', COALESCE(
        SUM(CASE WHEN s.payment_type = 'EFECTIVO' THEN s.total ELSE 0 END) +
        SUM(CASE WHEN s.payment_type = 'MIXTO' THEN COALESCE((s.payment_details->>'efectivo')::decimal, 0) ELSE 0 END),
        0
      ),
      'qr', COALESCE(
        SUM(CASE WHEN s.payment_type = 'QR' THEN s.total ELSE 0 END) +
        SUM(CASE WHEN s.payment_type = 'MIXTO' THEN COALESCE((s.payment_details->>'qr')::decimal, 0) ELSE 0 END),
        0
      ),
      'tarjeta', COALESCE(
        SUM(CASE WHEN s.payment_type = 'TARJETA' THEN s.total ELSE 0 END) +
        SUM(CASE WHEN s.payment_type = 'MIXTO' THEN COALESCE((s.payment_details->>'tarjeta')::decimal, 0) ELSE 0 END),
        0
      ),
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

COMMENT ON FUNCTION get_previous_month_revenue_report IS 'Obtiene el reporte del mes anterior. Los pagos mixtos se desglosan en sus componentes.';

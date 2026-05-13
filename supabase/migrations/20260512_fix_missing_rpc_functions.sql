-- Funciones RPC faltantes en la nueva base de datos Supabase
-- Generado: 2026-05-12

-- Eliminar funciones existentes con tipos de retorno incompatibles
DROP FUNCTION IF EXISTS get_cash_movements_grouped(uuid) CASCADE;
DROP FUNCTION IF EXISTS get_daily_sales_local(uuid, date) CASCADE;
DROP FUNCTION IF EXISTS get_sales_with_discounts(uuid, date) CASCADE;
DROP FUNCTION IF EXISTS get_mixed_payment_breakdown(uuid, date) CASCADE;
DROP FUNCTION IF EXISTS get_previous_month_revenue_report(uuid) CASCADE;
DROP FUNCTION IF EXISTS get_monthly_revenue_report(uuid, integer, integer) CASCADE;
DROP FUNCTION IF EXISTS get_monthly_revenue_comparison(uuid) CASCADE;
DROP FUNCTION IF EXISTS get_date_range_revenue_report(uuid, date, date) CASCADE;

-- === get_cash_movements_grouped (from 20250821_cash_flow_system.sql) ===
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
  WITH grouped_sale_ids AS (
    SELECT cm.reference_id
    FROM cash_movements cm
    WHERE cm.cash_register_id = p_cash_register_id
      AND cm.reference_type = 'SALE'
    GROUP BY cm.reference_id
    HAVING COUNT(*) > 1
  ),
  grouped_movements AS (
    SELECT 
      cm.reference_id,
      cm.reference_type,
      cm.movement_type,
      SUM(cm.amount) as total_amount,
      (array_agg(cm.id ORDER BY cm.created_at))[1] as first_id,
      (array_agg(cm.description ORDER BY cm.created_at))[1] as description,
      (array_agg(u.name ORDER BY cm.created_at))[1] as user_name,
      MIN(cm.created_at) as created_at
    FROM cash_movements cm
    JOIN users u ON u.id = cm.user_id
    WHERE cm.cash_register_id = p_cash_register_id
      AND cm.reference_id IN (SELECT reference_id FROM grouped_sale_ids)
    GROUP BY cm.reference_id, cm.reference_type, cm.movement_type
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
        SELECT reference_id FROM grouped_sale_ids
      ))
  )
  SELECT 
    gm.first_id as id,
    gm.movement_type,
    'MIXTO'::text as payment_type,
    gm.total_amount as amount,
    gm.description,
    gm.reference_id,
    gm.reference_type,
    gm.user_name,
    gm.created_at,
    gm.total_amount as total_amount,
    true as is_grouped
  FROM grouped_movements gm
  UNION ALL
  SELECT 
    im.id,
    im.movement_type,
    im.payment_type,
    im.amount,
    im.description,
    im.reference_id,
    im.reference_type,
    im.user_name,
    im.created_at,
    im.total_amount,
    im.is_grouped
  FROM individual_movements im
  ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- === get_daily_sales_local (from 20250911_fix_local_date_filters.sql) ===
CREATE OR REPLACE FUNCTION get_daily_sales_local(
  p_branch_id uuid,
  p_day date
)
RETURNS SETOF sales AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM sales
  WHERE branch_id = p_branch_id
    AND (sale_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/La_Paz')::date = p_day
  ORDER BY sale_date ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- === get_sales_with_discounts (from 20250911_fix_local_date_filters.sql) ===
CREATE OR REPLACE FUNCTION get_sales_with_discounts(
  branch_id_param uuid,
  sale_date_param date
)
RETURNS TABLE(
  total_sales decimal(10,2),
  total_discounts decimal(10,2),
  net_sales decimal(10,2),
  number_of_sales integer,
  sales_with_discounts integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(s.subtotal), 0) as total_sales,
    COALESCE(SUM(s.discount_amount), 0) as total_discounts,
    COALESCE(SUM(s.total), 0) as net_sales,
    COUNT(s.id)::integer as number_of_sales,
    COUNT(CASE WHEN s.discount_amount > 0 THEN 1 END)::integer as sales_with_discounts
  FROM sales s
  WHERE (s.sale_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/La_Paz')::date = sale_date_param
    AND s.branch_id = branch_id_param;
END;
$$ LANGUAGE plpgsql;

-- === get_mixed_payment_breakdown (from 20250911_fix_local_date_filters.sql) ===
CREATE OR REPLACE FUNCTION get_mixed_payment_breakdown(
  branch_id_param uuid,
  sale_date_param date
)
RETURNS TABLE(
  efectivo decimal(10,2),
  qr decimal(10,2),
  tarjeta decimal(10,2),
  count_sales integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM((s.payment_details->>'efectivo')::decimal), 0) as efectivo,
    COALESCE(SUM((s.payment_details->>'qr')::decimal), 0) as qr,
    COALESCE(SUM((s.payment_details->>'tarjeta')::decimal), 0) as tarjeta,
    COUNT(s.id)::integer as count_sales
  FROM sales s
  WHERE s.payment_type = 'MIXTO'
    AND (s.sale_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/La_Paz')::date = sale_date_param
    AND s.branch_id = branch_id_param;
END;
$$ LANGUAGE plpgsql;

-- === get_previous_month_revenue_report (from 20251118_fix_payment_breakdown.sql) ===
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
    COUNT(s.id)::integer as total_sales_count,
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

-- === get_monthly_revenue_report (from 20251118_fix_payment_breakdown.sql) ===
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
    COUNT(s.id)::integer as total_sales_count,
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

-- === get_monthly_revenue_comparison (from 20250113_add_previous_month_revenue_report_fixed.sql) ===
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

-- === get_date_range_revenue_report (from 20251118_fix_payment_breakdown.sql) ===
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


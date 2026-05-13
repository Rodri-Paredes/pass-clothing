-- ============================================================
-- EJECUTAR ESTE ARCHIVO COMPLETO EN SUPABASE SQL EDITOR
-- Corrige 5 funciones con errores en la DB nueva
-- ============================================================

-- 1. get_cash_movements_grouped (tenía MIN en UUID, que no existe en PostgreSQL)
DROP FUNCTION IF EXISTS get_cash_movements_grouped(uuid) CASCADE;
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

-- 2. get_sales_with_discounts (COUNT devuelve bigint pero declaraba integer)
DROP FUNCTION IF EXISTS get_sales_with_discounts(uuid, date) CASCADE;
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

-- 3. get_mixed_payment_breakdown (COUNT devuelve bigint pero declaraba integer)
DROP FUNCTION IF EXISTS get_mixed_payment_breakdown(uuid, date) CASCADE;
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

-- 4. get_previous_month_revenue_report (COUNT devuelve bigint pero declaraba integer)
DROP FUNCTION IF EXISTS get_previous_month_revenue_report(uuid) CASCADE;
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

-- 5. get_monthly_revenue_report (COUNT devuelve bigint pero declaraba integer)
DROP FUNCTION IF EXISTS get_monthly_revenue_report(uuid, integer, integer) CASCADE;
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

-- ============================================================
-- FIN - Si llegaste aquí sin errores, todo quedó OK
-- ============================================================

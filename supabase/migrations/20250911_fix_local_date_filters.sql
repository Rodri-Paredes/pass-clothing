-- Ensure all daily filters use local timezone (America/La_Paz, UTC-4)

-- First, drop existing functions with potentially incompatible signatures
DROP FUNCTION IF EXISTS get_daily_sales_local(uuid, date);
DROP FUNCTION IF EXISTS get_daily_cash_movements_local(uuid, date);
DROP FUNCTION IF EXISTS sum_total_sales(text, date, uuid);
DROP FUNCTION IF EXISTS count_sales(date, uuid);
DROP FUNCTION IF EXISTS count_products_sold(date, uuid);
DROP FUNCTION IF EXISTS sum_total_sales_card(date, uuid);
DROP FUNCTION IF EXISTS get_daily_report(uuid, date);
DROP FUNCTION IF EXISTS get_sales_with_discounts(uuid, date);
DROP FUNCTION IF EXISTS get_mixed_payment_breakdown(uuid, date);

-- 1) Replace aggregate/reporting functions to use local-day comparison
CREATE OR REPLACE FUNCTION sum_total_sales(
  payment_type_param text,
  sale_date_param date,
  branch_id_param uuid
)
RETURNS decimal(10,2) AS $$
DECLARE
  total_sum decimal(10,2);
BEGIN
  IF payment_type_param IS NULL THEN
    SELECT COALESCE(SUM(total),0) INTO total_sum
    FROM sales
    WHERE (sale_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/La_Paz')::date = sale_date_param
      AND branch_id = branch_id_param;
  ELSE
    SELECT COALESCE(SUM(total),0) INTO total_sum
    FROM sales
    WHERE (sale_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/La_Paz')::date = sale_date_param
      AND payment_type = payment_type_param
      AND branch_id = branch_id_param;
  END IF;
  RETURN total_sum;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION count_sales(
  sale_date_param date,
  branch_id_param uuid
)
RETURNS integer AS $$
BEGIN
  RETURN (
    SELECT COUNT(*) FROM sales
    WHERE (sale_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/La_Paz')::date = sale_date_param
      AND branch_id = branch_id_param
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION count_products_sold(
  sale_date_param date,
  branch_id_param uuid
)
RETURNS integer AS $$
BEGIN
  RETURN (
    SELECT COALESCE(SUM(si.quantity), 0)
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    WHERE (s.sale_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/La_Paz')::date = sale_date_param
      AND s.branch_id = branch_id_param
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sum_total_sales_card(
  sale_date_param date,
  branch_id_param uuid
)
RETURNS decimal(10,2) AS $$
DECLARE
  total_sum decimal(10,2);
BEGIN
  SELECT COALESCE(SUM(total),0) INTO total_sum
  FROM sales
  WHERE (sale_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/La_Paz')::date = sale_date_param
    AND payment_type = 'TARJETA'
    AND branch_id = branch_id_param;
  RETURN total_sum;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_daily_report(
  branch_id_param uuid,
  report_date date
)
RETURNS TABLE(
  total_sales decimal(10,2),
  number_of_sales integer,
  total_items_sold integer,
  cash_sales decimal(10,2),
  qr_sales decimal(10,2),
  card_sales decimal(10,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(s.total), 0) as total_sales,
    COUNT(s.id) as number_of_sales,
    COALESCE(SUM(si.quantity), 0) as total_items_sold,
    COALESCE(SUM(CASE WHEN s.payment_type = 'EFECTIVO' THEN s.total ELSE 0 END), 0) as cash_sales,
    COALESCE(SUM(CASE WHEN s.payment_type = 'QR' THEN s.total ELSE 0 END), 0) as qr_sales,
    COALESCE(SUM(CASE WHEN s.payment_type = 'TARJETA' THEN s.total ELSE 0 END), 0) as card_sales
  FROM sales s
  LEFT JOIN sale_items si ON s.id = si.sale_id
  WHERE (s.sale_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/La_Paz')::date = report_date
    AND s.branch_id = branch_id_param;
END;
$$ LANGUAGE plpgsql;

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
    COUNT(s.id) as number_of_sales,
    COUNT(CASE WHEN s.discount_amount > 0 THEN 1 END) as sales_with_discounts
  FROM sales s
  WHERE (s.sale_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/La_Paz')::date = sale_date_param
    AND s.branch_id = branch_id_param;
END;
$$ LANGUAGE plpgsql;

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
    COUNT(s.id) as count_sales
  FROM sales s
  WHERE s.payment_type = 'MIXTO'
    AND (s.sale_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/La_Paz')::date = sale_date_param
    AND s.branch_id = branch_id_param;
END;
$$ LANGUAGE plpgsql;

-- 2) Helper RPCs to fetch rows by local day
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

CREATE OR REPLACE FUNCTION get_daily_cash_movements_local(
  p_branch_id uuid,
  p_day date
)
RETURNS SETOF cash_movements AS $$
BEGIN
  RETURN QUERY
  SELECT cm.*
  FROM cash_movements cm
  JOIN cash_registers cr ON cr.id = cm.cash_register_id
  WHERE cr.branch_id = p_branch_id
    AND cm.reference_id IS NULL
    AND (cm.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/La_Paz')::date = p_day
  ORDER BY cm.created_at ASC;
END;
$$ LANGUAGE plpgsql STABLE;




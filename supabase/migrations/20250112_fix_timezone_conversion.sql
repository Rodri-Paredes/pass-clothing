-- Fix timezone conversion in get_daily_sales_local function
-- The issue is that we're double-converting the timezone

CREATE OR REPLACE FUNCTION get_daily_sales_local(
  p_branch_id uuid,
  p_day date
)
RETURNS SETOF sales AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM sales
  WHERE branch_id = p_branch_id
    AND (sale_date AT TIME ZONE 'America/La_Paz')::date = p_day
  ORDER BY sale_date ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Also fix the other functions to use the same logic
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
    AND (cm.created_at AT TIME ZONE 'America/La_Paz')::date = p_day
  ORDER BY cm.created_at ASC;
END;
$$ LANGUAGE plpgsql STABLE;

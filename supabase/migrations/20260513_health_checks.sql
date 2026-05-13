-- ============================================================
-- HEALTH CHECK FUNCTIONS
-- Execute these in Supabase SQL Editor
-- ============================================================

-- 1. Main health check: returns a JSON with all integrity checks
CREATE OR REPLACE FUNCTION run_health_check()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  negative_stock INTEGER;
  orphan_stock INTEGER;
  orphan_sale_items INTEGER;
  products_no_variants INTEGER;
  duplicate_branches INTEGER;
  open_registers INTEGER;
  sales_no_register INTEGER;
BEGIN
  -- Check: negative stock
  SELECT COUNT(*)::INTEGER INTO negative_stock
  FROM stock WHERE quantity < 0;

  -- Check: stock entries with no matching variant
  SELECT COUNT(*)::INTEGER INTO orphan_stock
  FROM stock s
  WHERE NOT EXISTS (SELECT 1 FROM product_variants pv WHERE pv.id = s.variant_id);

  -- Check: sale items with no matching variant
  SELECT COUNT(*)::INTEGER INTO orphan_sale_items
  FROM sale_items si
  WHERE NOT EXISTS (SELECT 1 FROM product_variants pv WHERE pv.id = si.variant_id);

  -- Check: products with no variants at all
  SELECT COUNT(*)::INTEGER INTO products_no_variants
  FROM products p
  WHERE NOT EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id);

  -- Check: branches with duplicate names
  SELECT COUNT(*)::INTEGER INTO duplicate_branches
  FROM (
    SELECT name, COUNT(*) AS cnt
    FROM branches
    GROUP BY name
    HAVING COUNT(*) > 1
  ) sub;

  -- Count open cash registers per branch
  SELECT COUNT(*)::INTEGER INTO open_registers
  FROM cash_registers
  WHERE closed_at IS NULL;

  -- Check: sales with no associated cash register
  SELECT COUNT(*)::INTEGER INTO sales_no_register
  FROM sales s
  WHERE NOT EXISTS (
    SELECT 1 FROM cash_registers cr
    WHERE cr.branch_id = s.branch_id
      AND cr.opened_at <= s.created_at
      AND (cr.closed_at IS NULL OR cr.closed_at >= s.created_at)
  );

  result := jsonb_build_object(
    'checked_at', NOW(),
    'status', CASE
      WHEN negative_stock > 0 OR orphan_stock > 0 OR orphan_sale_items > 0 OR duplicate_branches > 0
      THEN 'critical'
      WHEN products_no_variants > 0 OR sales_no_register > 0
      THEN 'warning'
      ELSE 'ok'
    END,
    'checks', jsonb_build_object(
      'negative_stock',       jsonb_build_object('value', negative_stock,       'ok', negative_stock = 0),
      'orphan_stock',         jsonb_build_object('value', orphan_stock,         'ok', orphan_stock = 0),
      'orphan_sale_items',    jsonb_build_object('value', orphan_sale_items,    'ok', orphan_sale_items = 0),
      'products_no_variants', jsonb_build_object('value', products_no_variants, 'ok', products_no_variants = 0),
      'duplicate_branches',   jsonb_build_object('value', duplicate_branches,   'ok', duplicate_branches = 0),
      'open_registers',       jsonb_build_object('value', open_registers,       'ok', open_registers > 0),
      'sales_no_register',    jsonb_build_object('value', sales_no_register,    'ok', sales_no_register = 0)
    )
  );

  RETURN result;
END;
$$;

-- 2. System stats for the admin dashboard
CREATE OR REPLACE FUNCTION get_system_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  total_products INTEGER;
  total_variants INTEGER;
  total_stock_units INTEGER;
  total_sales INTEGER;
  total_revenue NUMERIC;
  branches_data JSONB;
BEGIN
  SELECT COUNT(*)::INTEGER INTO total_products FROM products;
  SELECT COUNT(*)::INTEGER INTO total_variants FROM product_variants;
  SELECT COALESCE(SUM(quantity), 0)::INTEGER INTO total_stock_units FROM stock;
  SELECT COUNT(*)::INTEGER INTO total_sales FROM sales;
  SELECT COALESCE(SUM(total), 0) INTO total_revenue FROM sales;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', b.id,
      'name', b.name,
      'stock_units', COALESCE(branch_stock.units, 0),
      'total_sales', COALESCE(branch_sales.count, 0),
      'total_revenue', COALESCE(branch_sales.revenue, 0),
      'cash_register_open', COALESCE(branch_cr.is_open, false),
      'cash_register_opened_at', branch_cr.opened_at
    )
  )
  INTO branches_data
  FROM branches b
  LEFT JOIN (
    SELECT s.branch_id, SUM(s.quantity)::INTEGER AS units
    FROM stock s
    GROUP BY s.branch_id
  ) branch_stock ON branch_stock.branch_id = b.id
  LEFT JOIN (
    SELECT s.branch_id, COUNT(*)::INTEGER AS count, SUM(s.total) AS revenue
    FROM sales s
    GROUP BY s.branch_id
  ) branch_sales ON branch_sales.branch_id = b.id
  LEFT JOIN (
    SELECT DISTINCT ON (branch_id) branch_id,
      (closed_at IS NULL) AS is_open,
      opened_at
    FROM cash_registers
    ORDER BY branch_id, opened_at DESC
  ) branch_cr ON branch_cr.branch_id = b.id;

  result := jsonb_build_object(
    'generated_at', NOW(),
    'totals', jsonb_build_object(
      'products', total_products,
      'variants', total_variants,
      'stock_units', total_stock_units,
      'sales', total_sales,
      'revenue', total_revenue
    ),
    'branches', COALESCE(branches_data, '[]'::JSONB)
  );

  RETURN result;
END;
$$;

-- Grant execute to authenticated users (admins check done at app layer)
GRANT EXECUTE ON FUNCTION run_health_check() TO authenticated;
GRANT EXECUTE ON FUNCTION get_system_stats() TO authenticated;

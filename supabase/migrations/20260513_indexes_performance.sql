-- ============================================================
-- PERFORMANCE INDEXES & ERROR LOGS TABLE
-- Execute in Supabase SQL Editor
-- NOTE: CONCURRENTLY removed — CREATE INDEX CONCURRENTLY cannot
-- run inside a transaction block (Supabase SQL Editor limitation).
-- Safe for migration: table is not under live write load.
-- ============================================================

-- Enable pg_trgm for fast ILIKE/full-text search on product names
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ────────────────────────────────────────────────────────────
-- products
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_products_visible_created
  ON products(is_visible, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_products_category
  ON products(category)
  WHERE is_visible = true;

CREATE INDEX IF NOT EXISTS idx_products_name_trgm
  ON products USING GIN (name gin_trgm_ops);

-- ────────────────────────────────────────────────────────────
-- product_variants
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id
  ON product_variants(product_id);

-- ────────────────────────────────────────────────────────────
-- stock
-- ────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_variant_branch
  ON stock(variant_id, branch_id);

CREATE INDEX IF NOT EXISTS idx_stock_branch_id
  ON stock(branch_id);

CREATE INDEX IF NOT EXISTS idx_stock_branch_quantity
  ON stock(branch_id, quantity)
  WHERE quantity < 10;

-- ────────────────────────────────────────────────────────────
-- sales
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sales_branch_sale_date
  ON sales(branch_id, sale_date DESC);

CREATE INDEX IF NOT EXISTS idx_sales_branch_created_at
  ON sales(branch_id, created_at DESC);

-- ────────────────────────────────────────────────────────────
-- sale_items
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id
  ON sale_items(sale_id);

CREATE INDEX IF NOT EXISTS idx_sale_items_variant_id
  ON sale_items(variant_id);

-- ────────────────────────────────────────────────────────────
-- cash_registers
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cash_registers_branch_status
  ON cash_registers(branch_id, closed_at)
  WHERE closed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_cash_registers_branch_opened_at
  ON cash_registers(branch_id, opened_at DESC);

-- ────────────────────────────────────────────────────────────
-- cash_movements
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cash_movements_register_id
  ON cash_movements(cash_register_id);

CREATE INDEX IF NOT EXISTS idx_cash_movements_created_at
  ON cash_movements(created_at DESC);

-- ────────────────────────────────────────────────────────────
-- ERROR LOGS TABLE (for operational alerts + audit)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS error_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  level       TEXT        NOT NULL CHECK (level IN ('critical', 'error', 'warning')),
  category    TEXT        NOT NULL CHECK (category IN (
    'sale', 'stock', 'cash_register', 'sync', 'rpc', 'permission', 'auth', 'inconsistency', 'unknown'
  )),
  message     TEXT        NOT NULL,
  details     JSONB,
  user_id     UUID        REFERENCES users(id) ON DELETE SET NULL,
  branch_id   UUID        REFERENCES branches(id) ON DELETE SET NULL,
  session_id  TEXT,
  resolved_at TIMESTAMPTZ
);

-- RLS: users can only insert their own errors; admins can read all
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own error logs"
  ON error_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Admins can read all error logs"
  ON error_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- Indexes for error_logs table
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at
  ON error_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_error_logs_level
  ON error_logs(level);

CREATE INDEX IF NOT EXISTS idx_error_logs_branch_id
  ON error_logs(branch_id, created_at DESC);

-- ────────────────────────────────────────────────────────────
-- OPTIMIZED get_dashboard_stats RPC
-- Replaces 7 sequential queries with a single server-side aggregation
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_dashboard_stats(p_branch_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_month_start  TIMESTAMPTZ;
  v_week_start   TIMESTAMPTZ;
  result         JSONB;
BEGIN
  -- Bolivia offset UTC-4
  v_month_start := date_trunc('month', NOW() AT TIME ZONE 'America/La_Paz') AT TIME ZONE 'America/La_Paz';
  v_week_start  := (NOW() AT TIME ZONE 'America/La_Paz' - INTERVAL '7 days')::DATE::TIMESTAMPTZ;

  WITH
    monthly_stats AS (
      SELECT
        COUNT(*)                              AS sales_count,
        COALESCE(SUM(total), 0)               AS revenue
      FROM sales
      WHERE branch_id = p_branch_id
        AND sale_date >= v_month_start
    ),
    total_stats AS (
      SELECT COUNT(*) AS total_sales
      FROM sales
      WHERE branch_id = p_branch_id
    ),
    monthly_items AS (
      SELECT COALESCE(SUM(si.quantity), 0) AS items_sold
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE s.branch_id = p_branch_id
        AND s.sale_date >= v_month_start
    ),
    top_product AS (
      SELECT
        p.name,
        SUM(si.quantity) AS total_sold
      FROM sale_items si
      JOIN product_variants pv ON pv.id = si.variant_id
      JOIN products p          ON p.id  = pv.product_id
      JOIN sales s             ON s.id  = si.sale_id
      WHERE s.branch_id = p_branch_id
        AND s.sale_date >= v_month_start
      GROUP BY p.id, p.name
      ORDER BY total_sold DESC
      LIMIT 1
    ),
    low_stock AS (
      SELECT
        p.name,
        pv.size,
        st.quantity
      FROM stock st
      JOIN product_variants pv ON pv.id = st.variant_id
      JOIN products p          ON p.id  = pv.product_id
      WHERE st.branch_id = p_branch_id
        AND st.quantity < 5
        AND st.quantity >= 0
      ORDER BY st.quantity ASC
      LIMIT 20
    ),
    daily_sales AS (
      SELECT
        (sale_date AT TIME ZONE 'America/La_Paz')::DATE AS sale_day,
        SUM(total)                                       AS daily_total
      FROM sales
      WHERE branch_id = p_branch_id
        AND sale_date >= v_week_start
      GROUP BY sale_day
      ORDER BY sale_day ASC
    )
  SELECT jsonb_build_object(
    'monthlyTotal',        (SELECT revenue FROM monthly_stats),
    'monthlySalesCount',   (SELECT sales_count FROM monthly_stats),
    'monthlyItemsSold',    (SELECT items_sold FROM monthly_items),
    'totalSales',          (SELECT total_sales FROM total_stats),
    'topProduct',          (SELECT jsonb_build_object('name', name, 'total_sold', total_sold) FROM top_product),
    'lowStockProducts',    (SELECT jsonb_agg(jsonb_build_object('name', name || ' (' || size || ')', 'quantity', quantity)) FROM low_stock),
    'dailySales',          (SELECT jsonb_agg(jsonb_build_object('date', sale_day::TEXT, 'total', daily_total) ORDER BY sale_day) FROM daily_sales)
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_dashboard_stats(UUID) TO authenticated;

-- ============================================================
-- EXPLAIN ANALYZE — Run each block individually in SQL Editor
-- These reveal the actual execution plan and cost of critical queries
-- ============================================================

-- ── 1. getSalesByBranch (most expensive regular query) ──────
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT s.id, s.total, s.sale_date, s.payment_type, s.created_at
FROM sales s
WHERE s.branch_id = '1d12a9c3-0000-0000-0000-000000000000'  -- replace with real Tarija ID
ORDER BY s.created_at DESC
LIMIT 100;

-- ── 2. loadStockByBranch (runs on every page mount) ─────────
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT st.id, st.variant_id, st.branch_id, st.quantity
FROM stock st
WHERE st.branch_id = '1d12a9c3-0000-0000-0000-000000000000';

-- ── 3. Pre-sale stock check per item (currently N=1 per item) ──
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT quantity
FROM stock
WHERE variant_id = 'aaaaaaaa-0000-0000-0000-000000000000'
  AND branch_id  = '1d12a9c3-0000-0000-0000-000000000000';

-- ── 4. Batch stock check (optimized version — all items at once) ──
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT variant_id, branch_id, quantity
FROM stock
WHERE branch_id = '1d12a9c3-0000-0000-0000-000000000000'
  AND variant_id IN (
    'aaaaaaaa-0000-0000-0000-000000000000',
    'bbbbbbbb-0000-0000-0000-000000000000',
    'cccccccc-0000-0000-0000-000000000000'
  );

-- ── 5. Dashboard monthly revenue (before RPC optimization) ───
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT total
FROM sales
WHERE branch_id = '1d12a9c3-0000-0000-0000-000000000000'
  AND sale_date >= '2026-05-01T00:00:00-04:00';

-- ── 6. Low stock products ────────────────────────────────────
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT st.id, st.quantity, pv.size, p.name
FROM stock st
JOIN product_variants pv ON pv.id = st.variant_id
JOIN products p          ON p.id  = pv.product_id
WHERE st.branch_id = '1d12a9c3-0000-0000-0000-000000000000'
  AND st.quantity < 5
ORDER BY st.quantity ASC;

-- ── 7. Product search with ILIKE (currently full table scan) ─
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, name, price, category
FROM products
WHERE is_visible = true
  AND (name ILIKE '%jeans%' OR description ILIKE '%jeans%');

-- After installing pg_trgm index, compare with:
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, name, price, category
FROM products
WHERE is_visible = true
  AND name % 'jeans';  -- uses trigram similarity (fast with GIN index)

-- ── 8. Open cash register check ──────────────────────────────
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, branch_id, opened_at
FROM cash_registers
WHERE branch_id = '1d12a9c3-0000-0000-0000-000000000000'
  AND closed_at IS NULL;

-- ── 9. sale_items by sale_id (in getDailyCashFlow) ───────────
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT si.id, si.quantity, si.unit_price
FROM sale_items si
WHERE si.sale_id IN (
  SELECT id FROM sales
  WHERE branch_id = '1d12a9c3-0000-0000-0000-000000000000'
    AND sale_date BETWEEN '2026-05-13T00:00:00-04:00' AND '2026-05-13T23:59:59-04:00'
);

-- ── 10. Check existing indexes on key tables ─────────────────
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('products', 'product_variants', 'stock', 'sales', 'sale_items', 'cash_registers', 'cash_movements')
ORDER BY tablename, indexname;

-- ── 11. Identify sequential scans (run after some usage) ─────
SELECT
  relname AS table,
  seq_scan,
  seq_tup_read,
  idx_scan,
  n_live_tup AS rows
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY seq_scan DESC;

-- ── 12. Identify slow queries (needs pg_stat_statements) ─────
-- Enable with: CREATE EXTENSION pg_stat_statements;
SELECT
  calls,
  round(mean_exec_time::NUMERIC, 2) AS avg_ms,
  round(total_exec_time::NUMERIC, 2) AS total_ms,
  rows,
  LEFT(query, 120) AS query_snippet
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 20;

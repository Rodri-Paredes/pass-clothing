-- ============================================================
-- CHECKLIST DE MIGRACIÓN - PASS Clothing ERP
-- Ejecutar ANTES de aplicar cualquier migración nueva
-- ============================================================

-- PASO 1: Snapshot de conteos actuales
-- Guardar estos números ANTES de migrar y comparar DESPUÉS
SELECT 
  (SELECT COUNT(*) FROM products) as total_products,
  (SELECT COUNT(*) FROM product_variants) as total_variants,
  (SELECT COUNT(*) FROM stock) as total_stock,
  (SELECT COUNT(*) FROM stock WHERE quantity > 0) as stock_with_quantity,
  (SELECT COUNT(*) FROM sales) as total_sales,
  (SELECT COUNT(*) FROM cash_movements) as total_movements,
  (SELECT COUNT(*) FROM users) as total_users,
  (SELECT COUNT(*) FROM cash_registers) as total_registers,
  NOW() as snapshot_at;

-- PASO 2: Verificar que no haya NULL en campos críticos de productos
SELECT 
  COUNT(*) FILTER (WHERE name IS NULL OR name = '') as products_without_name,
  COUNT(*) FILTER (WHERE description IS NULL) as products_without_description,
  COUNT(*) FILTER (WHERE price IS NULL OR price <= 0) as products_with_invalid_price,
  COUNT(*) FILTER (WHERE image_url IS NULL OR image_url = '') as products_without_image
FROM products;

-- PASO 3: Verificar stock negativo
SELECT COUNT(*) as stock_negativo 
FROM stock WHERE quantity < 0;

-- PASO 4: Verificar variantes huérfanas (sin producto padre)
SELECT COUNT(*) as variantes_huerfanas
FROM product_variants pv
LEFT JOIN products p ON p.id = pv.product_id
WHERE p.id IS NULL;

-- PASO 5: Verificar stock sin variante padre
SELECT COUNT(*) as stock_huerfano
FROM stock s
LEFT JOIN product_variants pv ON pv.id = s.variant_id
WHERE pv.id IS NULL;

-- PASO 6: Verificar ventas sin items
SELECT COUNT(*) as ventas_sin_items
FROM sales s
LEFT JOIN sale_items si ON si.sale_id = s.id
WHERE si.id IS NULL;

-- PASO 7: Verificar que todas las funciones RPC necesarias existen
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'get_open_cash_register',
    'close_cash_register', 
    'open_cash_register',
    'get_cash_register_summary',
    'get_cash_movements',
    'get_cash_movements_grouped',
    'get_cash_register_history',
    'sum_total_sales',
    'sum_total_sales_card',
    'get_daily_sales_local',
    'get_sales_with_discounts',
    'get_mixed_payment_breakdown',
    'get_previous_month_revenue_report',
    'get_monthly_revenue_report',
    'get_monthly_revenue_comparison',
    'get_date_range_revenue_report',
    'toggle_product_visibility',
    'update_product_visibility',
    'update_drop_status',
    'register_sale_movement',
    'update_stock_safe'
  )
ORDER BY routine_name;

-- PASO 8: Verificar que triggers críticos existen
SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name IN (
    'trigger_register_sale_movement',
    'trigger_audit_products',
    'trigger_audit_stock'
  )
ORDER BY trigger_name;

-- PASO 9: Verificar RLS activado en tablas críticas
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('products', 'sales', 'stock', 'users', 'cash_registers', 'cash_movements')
ORDER BY tablename;

-- PASO 10: Verificar cajas por sucursal
SELECT 
  b.name as sucursal,
  cr.status,
  cr.opening_date,
  cr.created_at
FROM cash_registers cr
JOIN branches b ON b.id = cr.branch_id
ORDER BY cr.created_at DESC;

-- ============================================================
-- DESPUÉS DE MIGRAR: re-ejecutar pasos 1-5 y comparar números
-- Los conteos NO deben bajar (excepto que la migración los elimine intencionalmente)
-- ============================================================

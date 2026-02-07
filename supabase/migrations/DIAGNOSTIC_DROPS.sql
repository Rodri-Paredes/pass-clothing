-- SCRIPT DE DIAGNÓSTICO: Sistema de Drops
-- Ejecuta este script en Supabase SQL Editor para verificar el estado de los drops

-- 1. Verificar estructura de tablas
SELECT 'VERIFICANDO TABLAS' as status;

SELECT 
  'drops' as tabla,
  COUNT(*) as total_registros
FROM drops
UNION ALL
SELECT 
  'drop_products' as tabla,
  COUNT(*) as total_registros
FROM drop_products;

-- 2. Listar todos los drops con su conteo de productos
SELECT 
  'DROPS CON CONTEO DE PRODUCTOS' as status;

SELECT 
  d.id,
  d.name,
  d.status,
  d.is_featured,
  d.launch_date,
  COUNT(dp.product_id) as product_count
FROM drops d
LEFT JOIN drop_products dp ON d.id = dp.drop_id
GROUP BY d.id, d.name, d.status, d.is_featured, d.launch_date
ORDER BY d.created_at DESC;

-- 3. Ver productos en drop_products
SELECT 
  'PRODUCTOS EN DROP_PRODUCTS' as status;

SELECT 
  dp.id,
  dp.drop_id,
  d.name as drop_name,
  dp.product_id,
  p.name as product_name,
  dp.is_featured,
  dp.sort_order,
  dp.created_at
FROM drop_products dp
JOIN drops d ON dp.drop_id = d.id
JOIN products p ON dp.product_id = p.id
ORDER BY d.name, dp.sort_order;

-- 4. Verificar drops sin productos
SELECT 
  'DROPS SIN PRODUCTOS' as status;

SELECT 
  d.id,
  d.name,
  d.status
FROM drops d
LEFT JOIN drop_products dp ON d.id = dp.drop_id
WHERE dp.id IS NULL
ORDER BY d.name;

-- 5. Verificar productos que están en products.drop_id pero no en drop_products
SELECT 
  'PRODUCTOS CON drop_id PERO NO EN drop_products' as status;

SELECT 
  p.id,
  p.name,
  p.drop_id,
  d.name as drop_name
FROM products p
JOIN drops d ON p.drop_id = d.id
LEFT JOIN drop_products dp ON dp.product_id = p.id AND dp.drop_id = p.drop_id
WHERE p.drop_id IS NOT NULL 
  AND dp.id IS NULL
ORDER BY d.name, p.name;

-- 6. Estadísticas generales
SELECT 
  'ESTADÍSTICAS GENERALES' as status;

SELECT 
  (SELECT COUNT(*) FROM drops) as total_drops,
  (SELECT COUNT(*) FROM drops WHERE status = 'ACTIVO') as drops_activos,
  (SELECT COUNT(*) FROM drops WHERE is_featured = true) as drops_destacados,
  (SELECT COUNT(DISTINCT drop_id) FROM drop_products) as drops_con_productos,
  (SELECT COUNT(*) FROM drop_products) as total_relaciones_drop_products;

-- 7. SCRIPT DE MIGRACIÓN: Si tienes productos con drop_id pero no en drop_products
-- Descomenta y ejecuta esta sección si el punto 5 muestra resultados:

/*
INSERT INTO drop_products (drop_id, product_id, is_featured, sort_order)
SELECT 
  p.drop_id,
  p.id as product_id,
  false as is_featured,
  0 as sort_order
FROM products p
LEFT JOIN drop_products dp ON dp.product_id = p.id AND dp.drop_id = p.drop_id
WHERE p.drop_id IS NOT NULL 
  AND dp.id IS NULL
ON CONFLICT (drop_id, product_id) DO NOTHING;

SELECT 'Productos migrados de products.drop_id a drop_products' as resultado;
*/

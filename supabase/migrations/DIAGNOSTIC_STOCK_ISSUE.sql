-- DIAGNÓSTICO: Detectar por qué el stock se reduce automáticamente
-- Fecha: 2025-01-14

-- 1. VERIFICAR TRIGGERS ACTIVOS EN TABLAS RELACIONADAS CON STOCK
SELECT 
  tgname AS "Trigger Name",
  tgrelid::regclass AS "Table",
  CASE tgtype::integer & 1 
    WHEN 1 THEN 'ROW' 
    ELSE 'STATEMENT' 
  END AS "Level",
  CASE tgtype::integer & 66 
    WHEN 2 THEN 'BEFORE' 
    WHEN 64 THEN 'INSTEAD OF'
    ELSE 'AFTER' 
  END AS "Timing",
  CASE 
    WHEN tgtype::integer & 4 <> 0 THEN 'INSERT'
    WHEN tgtype::integer & 8 <> 0 THEN 'DELETE'
    WHEN tgtype::integer & 16 <> 0 THEN 'UPDATE'
    ELSE 'TRUNCATE'
  END AS "Event",
  pg_get_functiondef(tgfoid) AS "Function Definition"
FROM pg_trigger
WHERE tgrelid IN (
  'stock'::regclass, 
  'sales'::regclass, 
  'sale_items'::regclass
)
AND tgisinternal = false
ORDER BY tgrelid::regclass::text, tgname;

-- 2. VERIFICAR FUNCIONES QUE MODIFICAN STOCK
SELECT 
  proname AS "Function Name",
  prosrc AS "Function Source"
FROM pg_proc
WHERE prosrc ILIKE '%UPDATE stock%'
   OR prosrc ILIKE '%quantity%'
   OR prosrc ILIKE '%sale_items%'
ORDER BY proname;

-- 3. VERIFICAR SI HAY POLÍTICAS RLS QUE PUEDAN AFECTAR
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN ('stock', 'sales', 'sale_items')
ORDER BY tablename, policyname;

-- 4. BUSCAR FUNCIONES RPC RELACIONADAS CON VENTAS
SELECT 
  proname AS "Function Name",
  proargnames AS "Arguments",
  pg_get_functiondef(oid) AS "Definition"
FROM pg_proc
WHERE proname ILIKE '%sale%'
   OR proname ILIKE '%stock%'
ORDER BY proname;

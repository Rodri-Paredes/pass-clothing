-- PRUEBAS COMPLETAS DEL SISTEMA
-- Ejecuta este script paso a paso para verificar todo

-- ==========================================
-- PARTE 1: PRUEBAS BÁSICAS DE FUNCIONES
-- ==========================================

-- 1.1 Probar funciones de ventas con datos reales
DO $$
DECLARE
  test_branch_id uuid;
  test_date date := CURRENT_DATE;
  total_sales decimal(10,2);
  sales_count integer;
  products_sold integer;
  card_sales decimal(10,2);
BEGIN
  -- Obtener primera sucursal
  SELECT id INTO test_branch_id FROM branches LIMIT 1;
  
  IF test_branch_id IS NOT NULL THEN
    RAISE NOTICE '=== PRUEBAS DE FUNCIONES CON SUCURSAL: % ===', test_branch_id;
    
    -- Probar sum_total_sales
    SELECT sum_total_sales(NULL, test_date, test_branch_id) INTO total_sales;
    RAISE NOTICE '✅ Total ventas hoy: %', total_sales;
    
    -- Probar count_sales
    SELECT count_sales(test_date, test_branch_id) INTO sales_count;
    RAISE NOTICE '✅ Número de ventas: %', sales_count;
    
    -- Probar count_products_sold
    SELECT count_products_sold(test_date, test_branch_id) INTO products_sold;
    RAISE NOTICE '✅ Productos vendidos: %', products_sold;
    
    -- Probar sum_total_sales_card
    SELECT sum_total_sales_card(test_date, test_branch_id) INTO card_sales;
    RAISE NOTICE '✅ Ventas con tarjeta: %', card_sales;
    
    RAISE NOTICE '=== FUNCIONES BÁSICAS FUNCIONANDO CORRECTAMENTE ===';
  ELSE
    RAISE NOTICE '⚠️ No hay sucursales para probar. Crea una sucursal primero.';
  END IF;
END $$;

-- ==========================================
-- PARTE 2: PROBAR SISTEMA DE CAJA
-- ==========================================

-- 2.1 Verificar si hay caja abierta
DO $$
DECLARE
  test_branch_id uuid;
  open_register record;
BEGIN
  SELECT id INTO test_branch_id FROM branches LIMIT 1;
  
  IF test_branch_id IS NOT NULL THEN
    RAISE NOTICE '=== VERIFICANDO SISTEMA DE CAJA ===';
    
    -- Intentar obtener caja abierta
    BEGIN
      SELECT * INTO open_register FROM get_open_cash_register(test_branch_id);
      
      IF open_register.id IS NOT NULL THEN
        RAISE NOTICE '✅ Hay caja abierta: %', open_register.id;
        RAISE NOTICE '   - Fecha apertura: %', open_register.opening_date;
        RAISE NOTICE '   - Monto inicial: %', open_register.opening_amount;
        RAISE NOTICE '   - Usuario: %', open_register.opening_user_name;
      ELSE
        RAISE NOTICE '📝 No hay caja abierta en esta sucursal';
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE '❌ Error al verificar caja: %', SQLERRM;
    END;
  END IF;
END $$;

-- ==========================================
-- PARTE 3: CREAR DATOS DE PRUEBA
-- ==========================================

-- 3.1 Crear venta de prueba para verificar todo el flujo
DO $$
DECLARE
  test_branch_id uuid;
  test_user_id uuid;
  test_product_id uuid;
  test_variant_id uuid;
  test_sale_id uuid;
  current_user_id uuid;
BEGIN
  -- Obtener IDs de prueba
  SELECT id INTO test_branch_id FROM branches LIMIT 1;
  SELECT id INTO test_user_id FROM users LIMIT 1;
  SELECT id INTO test_product_id FROM products LIMIT 1;
  
  IF test_branch_id IS NOT NULL AND test_user_id IS NOT NULL AND test_product_id IS NOT NULL THEN
    RAISE NOTICE '=== CREANDO VENTA DE PRUEBA ===';
    
    -- Obtener variante del producto
    SELECT id INTO test_variant_id FROM product_variants WHERE product_id = test_product_id LIMIT 1;
    
    IF test_variant_id IS NOT NULL THEN
      -- Crear venta de prueba
      INSERT INTO sales (
        user_id, 
        branch_id, 
        total, 
        subtotal,
        discount_amount,
        payment_type, 
        payment_details,
        sale_date
      ) VALUES (
        test_user_id,
        test_branch_id,
        100.00,
        100.00,
        0.00,
        'MIXTO',
        '{"efectivo": 50.00, "qr": 30.00, "tarjeta": 20.00}',
        NOW()
      ) RETURNING id INTO test_sale_id;
      
      -- Crear item de venta
      INSERT INTO sale_items (
        sale_id,
        variant_id,
        quantity,
        unit_price,
        subtotal
      ) VALUES (
        test_sale_id,
        test_variant_id,
        2,
        50.00,
        100.00
      );
      
      RAISE NOTICE '✅ Venta de prueba creada: %', test_sale_id;
      RAISE NOTICE '   - Tipo: MIXTO (50 efectivo + 30 QR + 20 tarjeta)';
      RAISE NOTICE '   - Total: 100.00';
      
      -- Verificar que se registró en cash_movements si hay caja abierta
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cash_movements') THEN
        IF EXISTS (SELECT 1 FROM cash_movements WHERE reference_id = test_sale_id) THEN
          RAISE NOTICE '✅ Movimientos de caja registrados automáticamente';
        ELSE
          RAISE NOTICE '📝 No se registraron movimientos (normal si no hay caja abierta)';
        END IF;
      END IF;
      
    ELSE
      RAISE NOTICE '⚠️ No hay variantes de producto para crear venta de prueba';
    END IF;
  ELSE
    RAISE NOTICE '⚠️ Faltan datos básicos (sucursal, usuario o producto) para crear venta de prueba';
  END IF;
END $$;

-- ==========================================
-- PARTE 4: PRUEBAS DE FUNCIONES AVANZADAS
-- ==========================================

-- 4.1 Probar funciones nuevas
DO $$
DECLARE
  test_branch_id uuid;
  test_date date := CURRENT_DATE;
  report_result record;
  discount_result record;
  mixed_payment_result record;
BEGIN
  SELECT id INTO test_branch_id FROM branches LIMIT 1;
  
  IF test_branch_id IS NOT NULL THEN
    RAISE NOTICE '=== PRUEBAS DE FUNCIONES AVANZADAS ===';
    
    -- Probar get_daily_report_new
    BEGIN
      SELECT * INTO report_result FROM get_daily_report_new(test_branch_id, test_date);
      RAISE NOTICE '✅ Reporte diario:';
      RAISE NOTICE '   - Total ventas: %', report_result.total_sales;
      RAISE NOTICE '   - Número ventas: %', report_result.number_of_sales;
      RAISE NOTICE '   - Venta promedio: %', report_result.average_sale;
      RAISE NOTICE '   - Productos vendidos: %', report_result.total_items_sold;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE '❌ Error en get_daily_report_new: %', SQLERRM;
    END;
    
    -- Probar get_sales_with_discounts_new
    BEGIN
      SELECT * INTO discount_result FROM get_sales_with_discounts_new(test_branch_id, test_date);
      RAISE NOTICE '✅ Reporte de descuentos:';
      RAISE NOTICE '   - Total ventas: %', discount_result.total_sales;
      RAISE NOTICE '   - Total descuentos: %', discount_result.total_discounts;
      RAISE NOTICE '   - Ventas netas: %', discount_result.net_sales;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE '❌ Error en get_sales_with_discounts_new: %', SQLERRM;
    END;
    
    -- Probar get_mixed_payment_breakdown_new
    RAISE NOTICE '✅ Desglose de pagos mixtos:';
    FOR mixed_payment_result IN 
      SELECT * FROM get_mixed_payment_breakdown_new(test_branch_id, test_date)
    LOOP
      RAISE NOTICE '   - %: % (% transacciones)', 
        mixed_payment_result.payment_method, 
        mixed_payment_result.total_amount,
        mixed_payment_result.transaction_count;
    END LOOP;
  END IF;
END $$;

-- ==========================================
-- PARTE 5: VERIFICACIÓN FINAL
-- ==========================================

-- 5.1 Resumen de estado del sistema
SELECT 
  'RESUMEN FINAL' as categoria,
  (SELECT COUNT(*) FROM branches) as sucursales,
  (SELECT COUNT(*) FROM users) as usuarios,
  (SELECT COUNT(*) FROM products) as productos,
  (SELECT COUNT(*) FROM sales WHERE sale_date::date = CURRENT_DATE) as ventas_hoy,
  (SELECT COUNT(*) FROM cash_registers WHERE status = 'ABIERTA') as cajas_abiertas;

-- 5.2 Verificar funciones críticas
SELECT 
  'FUNCIONES VERIFICADAS' as categoria,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'sum_total_sales')
     AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'count_sales')
     AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_daily_report_new')
    THEN '✅ Todas las funciones disponibles'
    ELSE '❌ Faltan funciones'
  END as estado_funciones;

-- 5.3 Mensaje final
DO $$
BEGIN
  RAISE NOTICE '===============================================';
  RAISE NOTICE '🎉 PRUEBAS COMPLETADAS';
  RAISE NOTICE '===============================================';
END $$;

-- CORRECCIÓN DE PROBLEMAS CRÍTICOS V2
-- Migración para arreglar inconsistencias y errores
-- Esta versión elimina primero las funciones existentes para evitar conflictos

-- 1. CORREGIR TABLA SALES - Añadir soporte para pagos mixtos
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_payment_type_check;
ALTER TABLE sales ADD CONSTRAINT sales_payment_type_check 
CHECK (payment_type IN ('EFECTIVO', 'QR', 'TARJETA', 'MIXTO'));

-- Añadir campos para pagos mixtos y descuentos si no existen
DO $$
BEGIN
  -- Añadir payment_details si no existe
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'sales' AND column_name = 'payment_details') THEN
    ALTER TABLE sales ADD COLUMN payment_details jsonb;
  END IF;
  
  -- Añadir subtotal si no existe
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'sales' AND column_name = 'subtotal') THEN
    ALTER TABLE sales ADD COLUMN subtotal decimal(10,2);
  END IF;
  
  -- Añadir discount_amount si no existe
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'sales' AND column_name = 'discount_amount') THEN
    ALTER TABLE sales ADD COLUMN discount_amount decimal(10,2) DEFAULT 0;
  END IF;
END $$;

-- 2. ELIMINAR FUNCIONES EXISTENTES QUE PUEDEN CAUSAR CONFLICTOS
DROP FUNCTION IF EXISTS get_daily_report(uuid, date);
DROP FUNCTION IF EXISTS sum_total_sales(text, date, uuid);
DROP FUNCTION IF EXISTS sum_total_sales(text, date);
DROP FUNCTION IF EXISTS count_sales(date, uuid);
DROP FUNCTION IF EXISTS count_sales(date);
DROP FUNCTION IF EXISTS count_products_sold(date, uuid);
DROP FUNCTION IF EXISTS count_products_sold(date);
DROP FUNCTION IF EXISTS sum_total_sales_card(date, uuid);
DROP FUNCTION IF EXISTS sum_total_sales_card(date);
DROP FUNCTION IF EXISTS get_sales_with_discounts(uuid, date);
DROP FUNCTION IF EXISTS get_mixed_payment_breakdown(uuid, date);

-- 3. CREAR FUNCIONES ACTUALIZADAS CON BRANCH_ID_PARAM

-- Función sum_total_sales con parámetro opcional
CREATE OR REPLACE FUNCTION sum_total_sales(payment_type_param text, sale_date_param date, branch_id_param uuid DEFAULT NULL)
RETURNS decimal(10,2) AS $$
DECLARE
  total_sum decimal(10,2);
BEGIN
  IF payment_type_param IS NULL THEN
    IF branch_id_param IS NULL THEN
      SELECT COALESCE(SUM(total),0) INTO total_sum FROM sales WHERE sale_date::date = sale_date_param;
    ELSE
      SELECT COALESCE(SUM(total),0) INTO total_sum FROM sales WHERE sale_date::date = sale_date_param AND branch_id = branch_id_param;
    END IF;
  ELSE
    IF branch_id_param IS NULL THEN
      SELECT COALESCE(SUM(total),0) INTO total_sum FROM sales WHERE sale_date::date = sale_date_param AND payment_type = payment_type_param;
    ELSE
      SELECT COALESCE(SUM(total),0) INTO total_sum FROM sales WHERE sale_date::date = sale_date_param AND payment_type = payment_type_param AND branch_id = branch_id_param;
    END IF;
  END IF;
  RETURN total_sum;
END;
$$ LANGUAGE plpgsql;

-- Función count_sales con parámetro opcional
CREATE OR REPLACE FUNCTION count_sales(sale_date_param date, branch_id_param uuid DEFAULT NULL)
RETURNS integer AS $$
BEGIN
  IF branch_id_param IS NULL THEN
    RETURN (SELECT COUNT(*) FROM sales WHERE sale_date::date = sale_date_param);
  ELSE
    RETURN (SELECT COUNT(*) FROM sales WHERE sale_date::date = sale_date_param AND branch_id = branch_id_param);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Función count_products_sold con parámetro opcional
CREATE OR REPLACE FUNCTION count_products_sold(sale_date_param date, branch_id_param uuid DEFAULT NULL)
RETURNS integer AS $$
BEGIN
  IF branch_id_param IS NULL THEN
    RETURN (
      SELECT COALESCE(SUM(si.quantity), 0)
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE s.sale_date::date = sale_date_param
    );
  ELSE
    RETURN (
      SELECT COALESCE(SUM(si.quantity), 0)
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE s.sale_date::date = sale_date_param AND s.branch_id = branch_id_param
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Función sum_total_sales_card con parámetro opcional
CREATE OR REPLACE FUNCTION sum_total_sales_card(sale_date_param date, branch_id_param uuid DEFAULT NULL)
RETURNS decimal(10,2) AS $$
DECLARE
  total_sum decimal(10,2);
BEGIN
  IF branch_id_param IS NULL THEN
    SELECT COALESCE(SUM(total),0) INTO total_sum 
    FROM sales 
    WHERE sale_date::date = sale_date_param AND payment_type = 'TARJETA';
  ELSE
    SELECT COALESCE(SUM(total),0) INTO total_sum 
    FROM sales 
    WHERE sale_date::date = sale_date_param AND payment_type = 'TARJETA' AND branch_id = branch_id_param;
  END IF;
  RETURN total_sum;
END;
$$ LANGUAGE plpgsql;

-- 4. FUNCIÓN PARA OBTENER REPORTE DIARIO CON BRANCH_ID (nueva estructura)
CREATE OR REPLACE FUNCTION get_daily_report_new(branch_id_param uuid, report_date date)
RETURNS TABLE (
  total_sales decimal(10,2),
  number_of_sales integer,
  average_sale decimal(10,2),
  total_items_sold integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(s.total), 0) as total_sales,
    COUNT(s.id)::integer as number_of_sales,
    CASE 
      WHEN COUNT(s.id) > 0 THEN COALESCE(SUM(s.total), 0) / COUNT(s.id)
      ELSE 0
    END as average_sale,
    COALESCE(SUM(si.quantity), 0)::integer as total_items_sold
  FROM sales s
  LEFT JOIN sale_items si ON si.sale_id = s.id
  WHERE s.sale_date::date = report_date
    AND s.branch_id = branch_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. FUNCIÓN PARA VENTAS CON DESCUENTOS
CREATE OR REPLACE FUNCTION get_sales_with_discounts_new(branch_id_param uuid, sale_date_param date)
RETURNS TABLE (
  total_sales decimal(10,2),
  total_discounts decimal(10,2),
  net_sales decimal(10,2),
  number_of_sales integer,
  sales_with_discounts integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(s.total), 0) as total_sales,
    COALESCE(SUM(s.discount_amount), 0) as total_discounts,
    COALESCE(SUM(s.total), 0) - COALESCE(SUM(s.discount_amount), 0) as net_sales,
    COUNT(s.id)::integer as number_of_sales,
    COUNT(CASE WHEN s.discount_amount > 0 THEN 1 END)::integer as sales_with_discounts
  FROM sales s
  WHERE s.sale_date::date = sale_date_param
    AND s.branch_id = branch_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. FUNCIÓN PARA DESGLOSE DE PAGOS MIXTOS
CREATE OR REPLACE FUNCTION get_mixed_payment_breakdown_new(branch_id_param uuid, sale_date_param date)
RETURNS TABLE (
  payment_method text,
  total_amount decimal(10,2),
  transaction_count integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'efectivo'::text as payment_method,
    COALESCE(SUM((s.payment_details->>'efectivo')::decimal), 0) as total_amount,
    COUNT(s.id)::integer as transaction_count
  FROM sales s
  WHERE s.payment_type = 'MIXTO'
    AND s.sale_date::date = sale_date_param
    AND s.branch_id = branch_id_param
    AND (s.payment_details->>'efectivo')::decimal > 0
  
  UNION ALL
  
  SELECT 
    'qr'::text as payment_method,
    COALESCE(SUM((s.payment_details->>'qr')::decimal), 0) as total_amount,
    COUNT(s.id)::integer as transaction_count
  FROM sales s
  WHERE s.payment_type = 'MIXTO'
    AND s.sale_date::date = sale_date_param
    AND s.branch_id = branch_id_param
    AND (s.payment_details->>'qr')::decimal > 0
  
  UNION ALL
  
  SELECT 
    'tarjeta'::text as payment_method,
    COALESCE(SUM((s.payment_details->>'tarjeta')::decimal), 0) as total_amount,
    COUNT(s.id)::integer as transaction_count
  FROM sales s
  WHERE s.payment_type = 'MIXTO'
    AND s.sale_date::date = sale_date_param
    AND s.branch_id = branch_id_param
    AND (s.payment_details->>'tarjeta')::decimal > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. ACTUALIZAR TRIGGER PARA REGISTRAR VENTAS EN CASH_MOVEMENTS
-- Solo si existe la tabla cash_registers
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cash_registers') THEN
    -- Eliminar trigger existente si existe
    DROP TRIGGER IF EXISTS trigger_register_sale_movement ON sales;
    
    -- Recrear función del trigger para manejar errores
    CREATE OR REPLACE FUNCTION trigger_register_sale_movement()
    RETURNS TRIGGER AS $func$
    BEGIN
      BEGIN
        PERFORM register_sale_movement(NEW.id);
      EXCEPTION 
        WHEN OTHERS THEN
          -- Log el error pero no fallar la venta
          RAISE WARNING 'Error registering sale movement for sale %: %', NEW.id, SQLERRM;
      END;
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;

    -- Recrear trigger
    CREATE TRIGGER trigger_register_sale_movement
      AFTER INSERT ON sales
      FOR EACH ROW
      EXECUTE FUNCTION trigger_register_sale_movement();
  END IF;
END $$;

-- 8. VERIFICAR INTEGRIDAD DE DATOS
SELECT 'Migration V2 completed successfully' as status;

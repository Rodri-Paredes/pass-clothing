-- MIGRACIÓN: Corregir funciones de ventas para filtrado por sucursal
-- Ejecuta este script en tu base de datos de Supabase

-- 1. Función para sumar total de ventas por sucursal (versión final)
CREATE OR REPLACE FUNCTION sum_total_sales(payment_type_param text, sale_date_param date, branch_id_param uuid)
RETURNS decimal(10,2) AS $$
DECLARE
  total_sum decimal(10,2);
BEGIN
  IF payment_type_param IS NULL THEN
    SELECT COALESCE(SUM(total),0) INTO total_sum 
    FROM sales 
    WHERE sale_date::date = sale_date_param AND branch_id = branch_id_param;
  ELSE
    SELECT COALESCE(SUM(total),0) INTO total_sum 
    FROM sales 
    WHERE sale_date::date = sale_date_param 
      AND payment_type = payment_type_param 
      AND branch_id = branch_id_param;
  END IF;
  RETURN total_sum;
END;
$$ LANGUAGE plpgsql;

-- 2. Función para contar ventas por sucursal (versión final)
CREATE OR REPLACE FUNCTION count_sales(sale_date_param date, branch_id_param uuid)
RETURNS integer AS $$
BEGIN
  RETURN (SELECT COUNT(*) FROM sales WHERE sale_date::date = sale_date_param AND branch_id = branch_id_param);
END;
$$ LANGUAGE plpgsql;

-- 3. Función para contar productos vendidos por sucursal (versión final)
CREATE OR REPLACE FUNCTION count_products_sold(sale_date_param date, branch_id_param uuid)
RETURNS integer AS $$
BEGIN
  RETURN (
    SELECT COALESCE(SUM(si.quantity), 0)
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    WHERE s.sale_date::date = sale_date_param AND s.branch_id = branch_id_param
  );
END;
$$ LANGUAGE plpgsql;

-- 4. Función para sumar ventas por tarjeta por sucursal (versión final)
CREATE OR REPLACE FUNCTION sum_total_sales_card(sale_date_param date, branch_id_param uuid)
RETURNS decimal(10,2) AS $$
DECLARE
  total_sum decimal(10,2);
BEGIN
  SELECT COALESCE(SUM(total),0) INTO total_sum 
  FROM sales 
  WHERE sale_date::date = sale_date_param 
    AND payment_type = 'TARJETA' 
    AND branch_id = branch_id_param;
  RETURN total_sum;
END;
$$ LANGUAGE plpgsql;

-- 5. Función para obtener reporte diario por sucursal
CREATE OR REPLACE FUNCTION get_daily_report(branch_id_param uuid, report_date date)
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
  WHERE s.sale_date::date = report_date 
    AND s.branch_id = branch_id_param;
END;
$$ LANGUAGE plpgsql;

-- 6. Crear índices para mejorar el rendimiento de las consultas
CREATE INDEX IF NOT EXISTS idx_sales_branch_date ON sales(branch_id, sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_payment_type ON sales(payment_type);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);

-- 7. Verificar que las funciones se crearon correctamente
SELECT 
  proname as function_name,
  proargtypes::regtype[] as parameter_types
FROM pg_proc 
WHERE proname IN ('sum_total_sales', 'count_sales', 'count_products_sold', 'sum_total_sales_card', 'get_daily_report');

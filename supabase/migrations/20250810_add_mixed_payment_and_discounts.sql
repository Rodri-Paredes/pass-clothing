-- MIGRACIÓN: Agregar pago mixto y sistema de descuentos
-- Ejecuta este script en tu base de datos de Supabase

-- 1. Actualizar la tabla sales para incluir descuentos y pago mixto
ALTER TABLE sales ADD COLUMN IF NOT EXISTS discount_amount decimal(10,2) DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS subtotal decimal(10,2);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_details jsonb;

-- 2. Actualizar la restricción de payment_type para incluir MIXTO
ALTER TABLE sales DROP CONSTRAINT IF EXISTS chk_payment_type;
ALTER TABLE sales ADD CONSTRAINT chk_payment_type CHECK (payment_type IN ('EFECTIVO', 'QR', 'TARJETA', 'MIXTO'));

-- 3. Actualizar el total para que sea subtotal - descuento
UPDATE sales SET subtotal = total WHERE subtotal IS NULL;
UPDATE sales SET total = subtotal - discount_amount WHERE discount_amount > 0;

-- 4. Función para calcular total con descuento
CREATE OR REPLACE FUNCTION calculate_sale_total(subtotal_param decimal(10,2), discount_param decimal(10,2))
RETURNS decimal(10,2) AS $$
BEGIN
  RETURN GREATEST(0, subtotal_param - discount_param);
END;
$$ LANGUAGE plpgsql;

-- 5. Función para obtener reporte con descuentos
CREATE OR REPLACE FUNCTION get_sales_with_discounts(branch_id_param uuid, sale_date_param date)
RETURNS TABLE(
  total_sales decimal(10,2),
  total_discounts decimal(10,2),
  net_sales decimal(10,2),
  number_of_sales integer,
  sales_with_discounts integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(s.subtotal), 0) as total_sales,
    COALESCE(SUM(s.discount_amount), 0) as total_discounts,
    COALESCE(SUM(s.total), 0) as net_sales,
    COUNT(s.id) as number_of_sales,
    COUNT(CASE WHEN s.discount_amount > 0 THEN 1 END) as sales_with_discounts
  FROM sales s
  WHERE s.sale_date::date = sale_date_param 
    AND s.branch_id = branch_id_param;
END;
$$ LANGUAGE plpgsql;

-- 6. Función para obtener desglose de pagos mixtos
CREATE OR REPLACE FUNCTION get_mixed_payment_breakdown(branch_id_param uuid, sale_date_param date)
RETURNS TABLE(
  payment_method text,
  total_amount decimal(10,2),
  transaction_count integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'EFECTIVO' as payment_method,
    COALESCE(SUM(
      CASE 
        WHEN s.payment_type = 'EFECTIVO' THEN s.total
        WHEN s.payment_type = 'MIXTO' THEN (s.payment_details->>'efectivo')::decimal(10,2)
        ELSE 0 
      END
    ), 0) as total_amount,
    COUNT(CASE WHEN s.payment_type IN ('EFECTIVO', 'MIXTO') THEN 1 END) as transaction_count
  FROM sales s
  WHERE s.sale_date::date = sale_date_param 
    AND s.branch_id = branch_id_param
  
  UNION ALL
  
  SELECT 
    'QR' as payment_method,
    COALESCE(SUM(
      CASE 
        WHEN s.payment_type = 'QR' THEN s.total
        WHEN s.payment_type = 'MIXTO' THEN (s.payment_details->>'qr')::decimal(10,2)
        ELSE 0 
      END
    ), 0) as total_amount,
    COUNT(CASE WHEN s.payment_type IN ('QR', 'MIXTO') THEN 1 END) as transaction_count
  FROM sales s
  WHERE s.sale_date::date = sale_date_param 
    AND s.branch_id = branch_id_param
  
  UNION ALL
  
  SELECT 
    'TARJETA' as payment_method,
    COALESCE(SUM(
      CASE 
        WHEN s.payment_type = 'TARJETA' THEN s.total
        WHEN s.payment_type = 'MIXTO' THEN (s.payment_details->>'tarjeta')::decimal(10,2)
        ELSE 0 
      END
    ), 0) as total_amount,
    COUNT(CASE WHEN s.payment_type IN ('TARJETA', 'MIXTO') THEN 1 END) as transaction_count
  FROM sales s
  WHERE s.sale_date::date = sale_date_param 
    AND s.branch_id = branch_id_param;
END;
$$ LANGUAGE plpgsql;

-- 7. Crear índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_sales_discount ON sales(discount_amount);
CREATE INDEX IF NOT EXISTS idx_sales_payment_details ON sales USING GIN(payment_details);

-- 8. Verificar que las nuevas funciones se crearon
SELECT 
  proname as function_name,
  proargtypes::regtype[] as parameter_types
FROM pg_proc 
WHERE proname IN ('calculate_sale_total', 'get_sales_with_discounts', 'get_mixed_payment_breakdown');

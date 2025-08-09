-- FUNCIONES CORREGIDAS PARA ZONA HORARIA
-- Ejecuta este script en tu base de datos de Supabase

-- Función para sumar total de ventas (sin conversión de zona horaria)
CREATE OR REPLACE FUNCTION sum_total_sales(payment_type_param text, sale_date_param date)
RETURNS decimal(10,2) AS $$
DECLARE
  total_sum decimal(10,2);
BEGIN
  IF payment_type_param IS NULL THEN
    SELECT COALESCE(SUM(total),0) INTO total_sum FROM sales WHERE sale_date::date = sale_date_param;
  ELSE
    SELECT COALESCE(SUM(total),0) INTO total_sum FROM sales WHERE sale_date::date = sale_date_param AND payment_type = payment_type_param;
  END IF;
  RETURN total_sum;
END;
$$ LANGUAGE plpgsql;

-- Función para contar ventas (sin conversión de zona horaria)
CREATE OR REPLACE FUNCTION count_sales(sale_date_param date)
RETURNS integer AS $$
BEGIN
  RETURN (SELECT COUNT(*) FROM sales WHERE sale_date::date = sale_date_param);
END;
$$ LANGUAGE plpgsql;

-- Función para contar productos vendidos (sin conversión de zona horaria)
CREATE OR REPLACE FUNCTION count_products_sold(sale_date_param date)
RETURNS integer AS $$
BEGIN
  RETURN (
    SELECT COALESCE(SUM(si.quantity), 0)
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    WHERE s.sale_date::date = sale_date_param
  );
END;
$$ LANGUAGE plpgsql;

-- Función para sumar ventas por tarjeta (sin conversión de zona horaria)
CREATE OR REPLACE FUNCTION sum_total_sales_card(sale_date_param date)
RETURNS decimal(10,2) AS $$
DECLARE
  total_sum decimal(10,2);
BEGIN
  SELECT COALESCE(SUM(total),0) INTO total_sum 
  FROM sales 
  WHERE sale_date::date = sale_date_param AND payment_type = 'TARJETA';
  RETURN total_sum;
END;
$$ LANGUAGE plpgsql;

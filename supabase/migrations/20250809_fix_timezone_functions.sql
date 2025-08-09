-- FUNCIONES CORREGIDAS PARA ZONA HORARIA Y FILTRADO POR SUCURSAL
-- Ejecuta este script en tu base de datos de Supabase

-- Función para sumar total de ventas por sucursal
CREATE OR REPLACE FUNCTION sum_total_sales(payment_type_param text, sale_date_param date, branch_id_param uuid)
RETURNS decimal(10,2) AS $$
DECLARE
  total_sum decimal(10,2);
BEGIN
  IF payment_type_param IS NULL THEN
    SELECT COALESCE(SUM(total),0) INTO total_sum FROM sales WHERE sale_date::date = sale_date_param AND branch_id = branch_id_param;
  ELSE
    SELECT COALESCE(SUM(total),0) INTO total_sum FROM sales WHERE sale_date::date = sale_date_param AND payment_type = payment_type_param AND branch_id = branch_id_param;
  END IF;
  RETURN total_sum;
END;
$$ LANGUAGE plpgsql;

-- Función para contar ventas por sucursal
CREATE OR REPLACE FUNCTION count_sales(sale_date_param date, branch_id_param uuid)
RETURNS integer AS $$
BEGIN
  RETURN (SELECT COUNT(*) FROM sales WHERE sale_date::date = sale_date_param AND branch_id = branch_id_param);
END;
$$ LANGUAGE plpgsql;

-- Función para contar productos vendidos por sucursal
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

-- Función para sumar ventas por tarjeta por sucursal
CREATE OR REPLACE FUNCTION sum_total_sales_card(sale_date_param date, branch_id_param uuid)
RETURNS decimal(10,2) AS $$
DECLARE
  total_sum decimal(10,2);
BEGIN
  SELECT COALESCE(SUM(total),0) INTO total_sum 
  FROM sales 
  WHERE sale_date::date = sale_date_param AND payment_type = 'TARJETA' AND branch_id = branch_id_param;
  RETURN total_sum;
END;
$$ LANGUAGE plpgsql;

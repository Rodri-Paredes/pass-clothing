-- MIGRACION: Agregar campo payment_type a sales y funciones para cierre de caja

-- 1. Agregar columna payment_type a sales
ALTER TABLE sales ADD COLUMN payment_type text;

-- 2. Actualizar valores nulos a 'EFECTIVO' (si existen)
UPDATE sales SET payment_type = 'EFECTIVO' WHERE payment_type IS NULL;

-- 3. Restringir valores y no permitir nulos
ALTER TABLE sales ALTER COLUMN payment_type SET NOT NULL;
ALTER TABLE sales ADD CONSTRAINT chk_payment_type CHECK (payment_type IN ('EFECTIVO', 'QR'));

-- 4. Función para sumar total de ventas por tipo de pago y fecha
CREATE OR REPLACE FUNCTION sumTotalSales(paymentType text, saleDate date)
RETURNS decimal(10,2) AS $$
DECLARE
  total decimal(10,2);
BEGIN
  IF paymentType IS NULL THEN
    SELECT COALESCE(SUM(total),0) INTO total FROM sales WHERE sale_date::date = saleDate;
  ELSE
    SELECT COALESCE(SUM(total),0) INTO total FROM sales WHERE sale_date::date = saleDate AND payment_type = paymentType;
  END IF;
  RETURN total;
END;
$$ LANGUAGE plpgsql;

-- 5. Función para contar ventas por fecha
CREATE OR REPLACE FUNCTION countSales(saleDate date)
RETURNS integer AS $$
BEGIN
  RETURN (SELECT COUNT(*) FROM sales WHERE sale_date::date = saleDate);
END;
$$ LANGUAGE plpgsql;

-- 6. Función para contar productos vendidos por fecha
CREATE OR REPLACE FUNCTION countProductsSold(saleDate date)
RETURNS integer AS $$
BEGIN
  RETURN (
    SELECT COALESCE(SUM(si.quantity),0)
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    WHERE s.sale_date::date = saleDate
  );
END;
$$ LANGUAGE plpgsql;

ALTER TABLE sales ALTER COLUMN payment_type SET NOT NULL;
ALTER TABLE sales DROP CONSTRAINT IF EXISTS chk_payment_type;
ALTER TABLE sales ADD CONSTRAINT chk_payment_type CHECK (payment_type IN ('EFECTIVO', 'QR', 'TARJETA'));




-- 7. Error en el nombre de las funciones no tiene que ser pascal case

CREATE OR REPLACE FUNCTION sum_total_sales(payment_type text, sale_date date)
RETURNS decimal(10,2) AS $$
DECLARE
  total_sum decimal(10,2);
BEGIN
  IF payment_type IS NULL THEN
    SELECT COALESCE(SUM(total),0) INTO total_sum FROM sales WHERE sale_date::date = sale_date;
  ELSE
    SELECT COALESCE(SUM(total),0) INTO total_sum FROM sales WHERE sale_date::date = sale_date AND payment_type = payment_type;
  END IF;
  RETURN total_sum;
END;
$$ LANGUAGE plpgsql;

-- 2. Contar número de ventas
CREATE OR REPLACE FUNCTION count_sales(sale_date date)
RETURNS integer AS $$
BEGIN
  RETURN (SELECT COUNT(*) FROM sales WHERE sale_date::date = sale_date);
END;
$$ LANGUAGE plpgsql;

-- 3. Contar productos vendidos
CREATE OR REPLACE FUNCTION count_products_sold(sale_date date)
RETURNS integer AS $$
BEGIN
  RETURN (
    SELECT COALESCE(SUM(si.quantity), 0)
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    WHERE s.sale_date::date = sale_date
  );
END;
$$ LANGUAGE plpgsql;


-- 8. Actualizar funciones para que no tengan date 
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
-- 2. Contar número de ventas
CREATE OR REPLACE FUNCTION count_sales(sale_date_param date)
RETURNS integer AS $$
BEGIN
  RETURN (SELECT COUNT(*) FROM sales WHERE sale_date::date = sale_date_param);
END;
$$ LANGUAGE plpgsql;

-- 3. Contar productos vendidos
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
CREATE OR REPLACE FUNCTION sum_total_sales_card(sale_date_param date)
RETURNS decimal(10,2) AS $$
DECLARE
  total_sum decimal(10,2);
BEGIN
  SELECT COALESCE(SUM(total), 0)
  INTO total_sum
  FROM sales
  WHERE sale_date::date = sale_date_param
    AND payment_type ILIKE 'tarjeta';

  RETURN total_sum;
END;
$$ LANGUAGE plpgsql;

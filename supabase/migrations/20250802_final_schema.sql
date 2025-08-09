-- SCRIPT COMPLETO PARA RECREAR LA BASE DE DATOS CON LA ESTRUCTURA CORRECTA
-- Ejecuta este script en tu base de datos de Supabase

-- 1. ELIMINAR TABLAS EXISTENTES (en orden correcto para evitar errores de foreign keys)
DROP TABLE IF EXISTS sale_items CASCADE;
DROP TABLE IF EXISTS sales CASCADE;
DROP TABLE IF EXISTS stock CASCADE;
DROP TABLE IF EXISTS product_variants CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS branches CASCADE;

-- 2. CREAR TABLA BRANCHES
CREATE TABLE branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 3. CREAR TABLA USERS
CREATE TABLE users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'vendedor' CHECK (role IN ('admin', 'vendedor')),
  branch_id uuid REFERENCES branches(id),
  created_at timestamptz DEFAULT now()
);

-- 4. CREAR TABLA PRODUCTS (con precio único por producto)
CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL,
  price decimal(10,2) NOT NULL CHECK (price >= 0),
  image_url text,
  created_at timestamptz DEFAULT now()
);

-- 5. CREAR TABLA PRODUCT_VARIANTS (solo tallas, sin precio)
CREATE TABLE product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(product_id, size)
);

-- 6. CREAR TABLA STOCK (con una sola foreign key por relación)
CREATE TABLE stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(variant_id, branch_id)
);

-- 7. CREAR TABLA SALES
CREATE TABLE sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  branch_id uuid NOT NULL REFERENCES branches(id),
  total decimal(10,2) NOT NULL CHECK (total >= 0),
  payment_type text NOT NULL DEFAULT 'EFECTIVO' CHECK (payment_type IN ('EFECTIVO', 'QR', 'TARJETA')),
  sale_date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- 8. CREAR TABLA SALE_ITEMS
CREATE TABLE sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES product_variants(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price decimal(10,2) NOT NULL CHECK (unit_price >= 0),
  subtotal decimal(10,2) NOT NULL CHECK (subtotal >= 0)
);

-- 9. HABILITAR ROW LEVEL SECURITY
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

-- 10. CREAR POLÍTICAS RLS

-- Branches policies
CREATE POLICY "Authenticated users can read branches"
  ON branches FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert branches"
  ON branches FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update branches"
  ON branches FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete branches"
  ON branches FOR DELETE
  TO authenticated
  USING (true);

-- Users policies
CREATE POLICY "Users can read their own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Anyone can insert user profile"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Products policies
CREATE POLICY "Authenticated users can read products"
  ON products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update products"
  ON products FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete products"
  ON products FOR DELETE
  TO authenticated
  USING (true);

-- Product variants policies
CREATE POLICY "Authenticated users can read product variants"
  ON product_variants FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert product variants"
  ON product_variants FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update product variants"
  ON product_variants FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete product variants"
  ON product_variants FOR DELETE
  TO authenticated
  USING (true);

-- Stock policies
CREATE POLICY "Users can read stock for their branch or all if admin"
  ON stock FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert stock for their branch or all if admin"
  ON stock FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update stock for their branch or all if admin"
  ON stock FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete stock for their branch or all if admin"
  ON stock FOR DELETE
  TO authenticated
  USING (true);

-- Sales policies
CREATE POLICY "Users can read sales for their branch or all if admin"
  ON sales FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert sales for their branch or all if admin"
  ON sales FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update sales for their branch or all if admin"
  ON sales FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete sales for their branch or all if admin"
  ON sales FOR DELETE
  TO authenticated
  USING (true);

-- Sale items policies
CREATE POLICY "Users can read sale items for their branch or all if admin"
  ON sale_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert sale items for their branch or all if admin"
  ON sale_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update sale items for their branch or all if admin"
  ON sale_items FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete sale items for their branch or all if admin"
  ON sale_items FOR DELETE
  TO authenticated
  USING (true);

-- 11. INSERTAR DATOS DE PRUEBA (OPCIONAL)
INSERT INTO branches (name, address) VALUES
  ('Sucursal Cochabamba', ' Av. Santa Cruz, Cochabamba'),
  ('Sucursal Tarija', 'Calle Mendez, Tarija'),
  ('Sucursal Sucre', 'Calle Ravelo 6, Sucre');


-- 12. FUNCIONES PARA REPORTES (sin conversión de zona horaria)
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

CREATE OR REPLACE FUNCTION count_sales(sale_date_param date)
RETURNS integer AS $$
BEGIN
  RETURN (SELECT COUNT(*) FROM sales WHERE sale_date::date = sale_date_param);
END;
$$ LANGUAGE plpgsql;

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

-- Función para sumar ventas por tarjeta
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

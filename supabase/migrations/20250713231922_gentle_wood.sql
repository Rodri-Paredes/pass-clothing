/*
  # ERP System for Clothing Store - Complete Database Schema

  1. New Tables
    - `branches`
      - `id` (uuid, primary key)
      - `name` (text)
      - `address` (text)
      - `created_at` (timestamp)
    
    - `users`
      - `id` (uuid, primary key, references auth.users)
      - `name` (text)
      - `email` (text)
      - `role` (text) - 'admin' or 'vendedor'
      - `branch_id` (uuid, references branches)
      - `created_at` (timestamp)
    
    - `products`
      - `id` (uuid, primary key)
      - `name` (text)
      - `description` (text)
      - `category` (text)
      - `size` (text)
      - `price` (decimal)
      - `image_url` (text, optional)
      - `created_at` (timestamp)
    
    - `stock`
      - `id` (uuid, primary key)
      - `product_id` (uuid, references products)
      - `branch_id` (uuid, references branches)
      - `quantity` (integer)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `sales`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references users)
      - `branch_id` (uuid, references branches)
      - `total` (decimal)
      - `sale_date` (timestamp)
      - `created_at` (timestamp)
    
    - `sale_items`
      - `id` (uuid, primary key)
      - `sale_id` (uuid, references sales)
      - `product_id` (uuid, references products)
      - `quantity` (integer)
      - `unit_price` (decimal)
      - `subtotal` (decimal)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users based on roles
    - Admin can access all branches; vendedor only their assigned branch

  3. Storage
    - Create 'products' bucket for product images
    - Set appropriate access policies
*/

-- Create branches table
CREATE TABLE IF NOT EXISTS branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create users table (extends auth.users)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'vendedor' CHECK (role IN ('admin', 'vendedor')),
  branch_id uuid REFERENCES branches(id),
  created_at timestamptz DEFAULT now()
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL,
  size text NOT NULL,
  price decimal(10,2) NOT NULL CHECK (price >= 0),
  image_url text,
  created_at timestamptz DEFAULT now()
);

-- Create stock table
CREATE TABLE IF NOT EXISTS stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(product_id, branch_id)
);

-- Create sales table
CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  branch_id uuid NOT NULL REFERENCES branches(id),
  total decimal(10,2) NOT NULL CHECK (total >= 0),
  sale_date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create sale_items table
CREATE TABLE IF NOT EXISTS sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price decimal(10,2) NOT NULL CHECK (unit_price >= 0),
  subtotal decimal(10,2) NOT NULL CHECK (subtotal >= 0)
);

-- Enable Row Level Security
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies

-- Branches policies
CREATE POLICY "Authenticated users can read branches"
  ON branches FOR SELECT
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

-- Stock policies
CREATE POLICY "Users can read stock for their branch or all if admin"
  ON stock FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND (users.role = 'admin' OR users.branch_id = stock.branch_id)
    )
  );

CREATE POLICY "Users can manage stock for their branch or all if admin"
  ON stock FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND (users.role = 'admin' OR users.branch_id = stock.branch_id)
    )
  );

-- Sales policies
CREATE POLICY "Users can read sales for their branch or all if admin"
  ON sales FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND (users.role = 'admin' OR users.branch_id = sales.branch_id)
    )
  );

CREATE POLICY "Users can create sales for their branch or any if admin"
  ON sales FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND (users.role = 'admin' OR users.branch_id = sales.branch_id)
    )
  );

-- Sale items policies
CREATE POLICY "Users can read sale items through sales"
  ON sale_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales 
      JOIN users ON users.id = auth.uid()
      WHERE sales.id = sale_items.sale_id 
      AND (users.role = 'admin' OR users.branch_id = sales.branch_id)
    )
  );

CREATE POLICY "Users can insert sale items"
  ON sale_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Insert initial data
INSERT INTO branches (name, address) VALUES 
  ('Tarija', 'Av. Las Américas 123, Tarija'),
  ('Cochabamba', 'Av. Heroínas 456, Cochabamba'),
  ('Sucre', 'Calle Estudiantes 789, Sucre')
ON CONFLICT DO NOTHING;

-- Create storage bucket for product images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('products', 'products', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policy for products bucket
CREATE POLICY "Authenticated users can upload product images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'products');

CREATE POLICY "Anyone can view product images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'products');

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_stock_branch_product ON stock(branch_id, product_id);
CREATE INDEX IF NOT EXISTS idx_sales_branch_date ON sales(branch_id, sale_date);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_users_branch ON users(branch_id);

-- Create function to automatically update stock updated_at
CREATE OR REPLACE FUNCTION update_stock_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for stock table
DROP TRIGGER IF EXISTS trigger_update_stock_updated_at ON stock;
CREATE TRIGGER trigger_update_stock_updated_at
  BEFORE UPDATE ON stock
  FOR EACH ROW
  EXECUTE FUNCTION update_stock_updated_at();
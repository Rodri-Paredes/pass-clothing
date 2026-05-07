-- MIGRACIÓN: Sistema de Drops para PASS CLOTHING
-- Agrega funcionalidad para gestionar lanzamientos y colecciones de productos

-- 1. CREAR TABLA DROPS
CREATE TABLE IF NOT EXISTS drops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  launch_date timestamptz NOT NULL,
  end_date timestamptz,
  status text NOT NULL DEFAULT 'ACTIVO' CHECK (status IN ('ACTIVO', 'INACTIVO', 'FINALIZADO')),
  is_featured boolean DEFAULT false,
  image_url text,
  banner_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. CREAR TABLA DROP_PRODUCTS (relación muchos a muchos entre drops y products)
CREATE TABLE IF NOT EXISTS drop_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drop_id uuid NOT NULL REFERENCES drops(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  is_featured boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(drop_id, product_id)
);

-- 3. AGREGAR COLUMNA DROP_ID A PRODUCTS (opcional, para drops principales)
ALTER TABLE products ADD COLUMN IF NOT EXISTS drop_id uuid REFERENCES drops(id);

-- 4. HABILITAR ROW LEVEL SECURITY
ALTER TABLE drops ENABLE ROW LEVEL SECURITY;
ALTER TABLE drop_products ENABLE ROW LEVEL SECURITY;

-- 5. CREAR POLÍTICAS RLS PARA DROPS
CREATE POLICY "Authenticated users can read drops"
  ON drops FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert drops"
  ON drops FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update drops"
  ON drops FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete drops"
  ON drops FOR DELETE
  TO authenticated
  USING (true);

-- 6. CREAR POLÍTICAS RLS PARA DROP_PRODUCTS
CREATE POLICY "Authenticated users can read drop_products"
  ON drop_products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert drop_products"
  ON drop_products FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update drop_products"
  ON drop_products FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete drop_products"
  ON drop_products FOR DELETE
  TO authenticated
  USING (true);

-- 7. CREAR ÍNDICES PARA OPTIMIZACIÓN
CREATE INDEX IF NOT EXISTS idx_drops_status ON drops(status);
CREATE INDEX IF NOT EXISTS idx_drops_launch_date ON drops(launch_date);
CREATE INDEX IF NOT EXISTS idx_drops_featured ON drops(is_featured);
CREATE INDEX IF NOT EXISTS idx_drop_products_drop_id ON drop_products(drop_id);
CREATE INDEX IF NOT EXISTS idx_drop_products_product_id ON drop_products(product_id);
CREATE INDEX IF NOT EXISTS idx_products_drop_id ON products(drop_id);

-- 8. CREAR FUNCIONES ÚTILES PARA DROPS

-- Función para obtener productos de un drop específico
CREATE OR REPLACE FUNCTION get_drop_products(drop_id_param uuid)
RETURNS TABLE (
  product_id uuid,
  product_name text,
  product_description text,
  product_category text,
  product_price decimal(10,2),
  product_image_url text,
  is_featured boolean,
  sort_order integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.description,
    p.category,
    p.price,
    p.image_url,
    dp.is_featured,
    dp.sort_order
  FROM products p
  JOIN drop_products dp ON p.id = dp.product_id
  WHERE dp.drop_id = drop_id_param
  ORDER BY dp.sort_order ASC, p.name ASC;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener drops activos
CREATE OR REPLACE FUNCTION get_active_drops()
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  launch_date timestamptz,
  end_date timestamptz,
  status text,
  is_featured boolean,
  image_url text,
  banner_url text,
  product_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.name,
    d.description,
    d.launch_date,
    d.end_date,
    d.status,
    d.is_featured,
    d.image_url,
    d.banner_url,
    COUNT(dp.product_id) as product_count
  FROM drops d
  LEFT JOIN drop_products dp ON d.id = dp.drop_id
  WHERE d.status = 'ACTIVO'
  GROUP BY d.id, d.name, d.description, d.launch_date, d.end_date, d.status, d.is_featured, d.image_url, d.banner_url
  ORDER BY d.is_featured DESC, d.launch_date DESC;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener drops destacados
CREATE OR REPLACE FUNCTION get_featured_drops()
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  launch_date timestamptz,
  end_date timestamptz,
  status text,
  is_featured boolean,
  image_url text,
  banner_url text,
  product_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.name,
    d.description,
    d.launch_date,
    d.end_date,
    d.status,
    d.is_featured,
    d.image_url,
    d.banner_url,
    COUNT(dp.product_id) as product_count
  FROM drops d
  LEFT JOIN drop_products dp ON d.id = dp.drop_id
  WHERE d.status = 'ACTIVO' AND d.is_featured = true
  GROUP BY d.id, d.name, d.description, d.launch_date, d.end_date, d.status, d.is_featured, d.image_url, d.banner_url
  ORDER BY d.launch_date DESC;
END;
$$ LANGUAGE plpgsql;

-- Función para actualizar el estado de drops basado en fechas
CREATE OR REPLACE FUNCTION update_drop_status()
RETURNS void AS $$
BEGIN
  -- Marcar drops como finalizados si han pasado su fecha de fin
  UPDATE drops 
  SET status = 'FINALIZADO', updated_at = now()
  WHERE status = 'ACTIVO' 
    AND end_date IS NOT NULL 
    AND end_date < now();
    
  -- Marcar drops como activos si han llegado a su fecha de lanzamiento
  UPDATE drops 
  SET status = 'ACTIVO', updated_at = now()
  WHERE status = 'INACTIVO' 
    AND launch_date <= now()
    AND (end_date IS NULL OR end_date > now());
END;
$$ LANGUAGE plpgsql;

-- 9. CREAR TRIGGER PARA ACTUALIZAR updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_drops_updated_at
  BEFORE UPDATE ON drops
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 10. INSERTAR DATOS DE PRUEBA (OPCIONAL)
INSERT INTO drops (name, description, launch_date, end_date, status, is_featured, image_url) VALUES
  ('Colección Verano 2024', 'Nueva colección de verano con diseños frescos y colores vibrantes', '2024-01-15 00:00:00', '2024-03-31 23:59:59', 'ACTIVO', true, 'https://example.com/summer-collection.jpg'),
  ('Drop Limitado Streetwear', 'Edición limitada de streetwear con diseños exclusivos', '2024-01-20 00:00:00', '2024-02-29 23:59:59', 'ACTIVO', false, 'https://example.com/streetwear-drop.jpg'),
  ('Colección Básicos', 'Piezas esenciales para el guardarropa', '2024-01-10 00:00:00', '2024-12-31 23:59:59', 'ACTIVO', false, 'https://example.com/basics-collection.jpg');

-- 11. COMENTARIOS EN LAS TABLAS
COMMENT ON TABLE drops IS 'Tabla para gestionar lanzamientos y colecciones de productos';
COMMENT ON TABLE drop_products IS 'Tabla de relación muchos a muchos entre drops y products';
COMMENT ON COLUMN drops.name IS 'Nombre del drop o colección';
COMMENT ON COLUMN drops.launch_date IS 'Fecha de lanzamiento del drop';
COMMENT ON COLUMN drops.end_date IS 'Fecha de finalización del drop (opcional)';
COMMENT ON COLUMN drops.status IS 'Estado del drop: ACTIVO, INACTIVO, FINALIZADO';
COMMENT ON COLUMN drops.is_featured IS 'Indica si el drop es destacado';
COMMENT ON COLUMN drop_products.is_featured IS 'Indica si el producto es destacado dentro del drop';
COMMENT ON COLUMN drop_products.sort_order IS 'Orden de visualización del producto en el drop';



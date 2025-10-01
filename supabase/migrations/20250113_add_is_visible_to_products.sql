-- Migración para agregar el campo is_visible a la tabla products
-- Este campo permitirá ocultar/mostrar productos en la interfaz

-- Agregar el campo is_visible a la tabla products
ALTER TABLE products 
ADD COLUMN is_visible boolean NOT NULL DEFAULT true;

-- Crear un comentario para documentar el campo
COMMENT ON COLUMN products.is_visible IS 'Indica si el producto es visible en la interfaz de usuario. true = visible, false = oculto';

-- Actualizar productos existentes para que sean visibles por defecto
UPDATE products SET is_visible = true WHERE is_visible IS NULL;

-- Crear un índice para optimizar las consultas por visibilidad
CREATE INDEX idx_products_is_visible ON products(is_visible);

-- Crear una función para obtener solo productos visibles
CREATE OR REPLACE FUNCTION get_visible_products()
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  category text,
  price decimal(10,2),
  image_url text,
  is_visible boolean,
  created_at timestamptz
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
    p.is_visible,
    p.created_at
  FROM products p
  WHERE p.is_visible = true
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Crear una función para obtener productos visibles con paginación
CREATE OR REPLACE FUNCTION get_visible_products_paginated(
  page_size integer DEFAULT 20,
  page_offset integer DEFAULT 0,
  search_term text DEFAULT NULL,
  category_filter text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  category text,
  price decimal(10,2),
  image_url text,
  is_visible boolean,
  created_at timestamptz,
  total_count bigint
) AS $$
DECLARE
  total_count bigint;
BEGIN
  -- Calcular el total de productos visibles que coinciden con los filtros
  SELECT COUNT(*) INTO total_count
  FROM products p
  WHERE p.is_visible = true
    AND (search_term IS NULL OR p.name ILIKE '%' || search_term || '%' OR p.description ILIKE '%' || search_term || '%')
    AND (category_filter IS NULL OR p.category = category_filter);

  -- Retornar los productos con paginación
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.description,
    p.category,
    p.price,
    p.image_url,
    p.is_visible,
    p.created_at,
    total_count
  FROM products p
  WHERE p.is_visible = true
    AND (search_term IS NULL OR p.name ILIKE '%' || search_term || '%' OR p.description ILIKE '%' || search_term || '%')
    AND (category_filter IS NULL OR p.category = category_filter)
  ORDER BY p.created_at DESC
  LIMIT page_size OFFSET page_offset;
END;
$$ LANGUAGE plpgsql;

-- Crear una función para alternar la visibilidad de un producto
CREATE OR REPLACE FUNCTION toggle_product_visibility(product_id uuid)
RETURNS boolean AS $$
DECLARE
  new_visibility boolean;
BEGIN
  -- Obtener el estado actual y cambiarlo
  UPDATE products 
  SET is_visible = NOT is_visible
  WHERE id = product_id
  RETURNING is_visible INTO new_visibility;
  
  -- Si no se actualizó ningún registro, el producto no existe
  IF new_visibility IS NULL THEN
    RAISE EXCEPTION 'Producto con ID % no encontrado', product_id;
  END IF;
  
  RETURN new_visibility;
END;
$$ LANGUAGE plpgsql;

-- Crear una función para actualizar la visibilidad de un producto
CREATE OR REPLACE FUNCTION update_product_visibility(product_id uuid, visible boolean)
RETURNS boolean AS $$
DECLARE
  updated_visibility boolean;
BEGIN
  -- Actualizar la visibilidad del producto
  UPDATE products 
  SET is_visible = visible
  WHERE id = product_id
  RETURNING is_visible INTO updated_visibility;
  
  -- Si no se actualizó ningún registro, el producto no existe
  IF updated_visibility IS NULL THEN
    RAISE EXCEPTION 'Producto con ID % no encontrado', product_id;
  END IF;
  
  RETURN updated_visibility;
END;
$$ LANGUAGE plpgsql;


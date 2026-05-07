-- MIGRACIÓN: CORRECCIÓN DE PROBLEMAS CRÍTICOS
-- Fecha: 2025-01-13
-- Problemas a corregir:
-- 1. Stock fantasma entre sucursales
-- 2. Productos sin stock que aparecen con stock
-- 3. Imágenes perdidas
-- 4. Funcionalidad de eliminación

-- ===========================================
-- 1. LIMPIAR STOCK FANTASMA
-- ===========================================

-- Eliminar registros de stock con cantidad 0 o negativa
DELETE FROM stock WHERE quantity <= 0;

-- Eliminar registros de stock duplicados (mantener solo el más reciente)
WITH duplicate_stock AS (
  SELECT 
    variant_id,
    branch_id,
    id,
    ROW_NUMBER() OVER (
      PARTITION BY variant_id, branch_id 
      ORDER BY updated_at DESC, created_at DESC
    ) as rn
  FROM stock
)
DELETE FROM stock 
WHERE id IN (
  SELECT id FROM duplicate_stock WHERE rn > 1
);

-- ===========================================
-- 2. CORREGIR PRODUCTOS SIN VARIANTES
-- ===========================================

-- Crear variantes para productos que no las tienen
INSERT INTO product_variants (product_id, size)
SELECT 
  p.id,
  'M' -- Talla por defecto
FROM products p
WHERE NOT EXISTS (
  SELECT 1 FROM product_variants pv 
  WHERE pv.product_id = p.id
);

-- ===========================================
-- 3. CORREGIR STOCK SIN VARIANTES
-- ===========================================

-- Eliminar stock que no tiene variante válida
DELETE FROM stock 
WHERE variant_id NOT IN (
  SELECT id FROM product_variants
);

-- ===========================================
-- 4. ACTUALIZAR FUNCIÓN DE ELIMINACIÓN SEGURA
-- ===========================================

-- Función para eliminar producto con todas sus dependencias
CREATE OR REPLACE FUNCTION delete_product_safe(p_product_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_product_name text;
  v_image_url text;
BEGIN
  -- Obtener información del producto
  SELECT name, image_url INTO v_product_name, v_image_url
  FROM products 
  WHERE id = p_product_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto no encontrado: %', p_product_id;
  END IF;
  
  -- Log de inicio
  RAISE NOTICE 'Eliminando producto: % (ID: %)', v_product_name, p_product_id;
  
  -- Eliminar stock primero (para evitar problemas de FK)
  DELETE FROM stock 
  WHERE variant_id IN (
    SELECT id FROM product_variants WHERE product_id = p_product_id
  );
  
  -- Eliminar variantes
  DELETE FROM product_variants WHERE product_id = p_product_id;
  
  -- Eliminar el producto
  DELETE FROM products WHERE id = p_product_id;
  
  -- Log de éxito
  RAISE NOTICE 'Producto eliminado exitosamente: %', v_product_name;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error eliminando producto %: %', v_product_name, SQLERRM;
END;
$$;

-- ===========================================
-- 5. MEJORAR POLÍTICAS DE STORAGE
-- ===========================================

-- Eliminar políticas existentes de storage
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete product images" ON storage.objects;

-- Crear políticas mejoradas
CREATE POLICY "Authenticated users can upload product images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'products' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view product images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'products');

CREATE POLICY "Authenticated users can delete product images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'products' AND auth.role() = 'authenticated');

-- ===========================================
-- 6. FUNCIÓN PARA LIMPIAR IMÁGENES HUÉRFANAS
-- ===========================================

CREATE OR REPLACE FUNCTION cleanup_orphaned_images()
RETURNS TABLE(
  image_name text,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec RECORD;
BEGIN
  -- Buscar imágenes en storage que no están referenciadas en products
  FOR rec IN
    SELECT name
    FROM storage.objects
    WHERE bucket_id = 'products'
      AND name NOT IN (
        SELECT 
          CASE 
            WHEN image_url LIKE '%/products/%' THEN 
              substring(image_url from '.*/products/(.*)$')
            ELSE NULL
          END
        FROM products 
        WHERE image_url IS NOT NULL
      )
  LOOP
    -- Intentar eliminar la imagen huérfana
    BEGIN
      DELETE FROM storage.objects 
      WHERE bucket_id = 'products' AND name = rec.name;
      
      image_name := rec.name;
      status := 'ELIMINADA';
      RETURN NEXT;
      
    EXCEPTION
      WHEN OTHERS THEN
        image_name := rec.name;
        status := 'ERROR: ' || SQLERRM;
        RETURN NEXT;
    END;
  END LOOP;
END;
$$;

-- ===========================================
-- 7. ÍNDICES PARA MEJOR RENDIMIENTO
-- ===========================================

-- Índices para búsquedas de stock
CREATE INDEX IF NOT EXISTS idx_stock_variant_branch ON stock(variant_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_quantity ON stock(quantity);
CREATE INDEX IF NOT EXISTS idx_stock_branch_quantity ON stock(branch_id, quantity);

-- Índices para product_variants
CREATE INDEX IF NOT EXISTS idx_product_variants_product_size ON product_variants(product_id, size);

-- Índices para products
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);

-- ===========================================
-- 8. TRIGGER PARA LIMPIAR IMÁGENES AL ELIMINAR PRODUCTOS
-- ===========================================

-- Función trigger para limpiar imágenes
CREATE OR REPLACE FUNCTION cleanup_product_image()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_image_name text;
BEGIN
  -- Si el producto tenía una imagen, intentar eliminarla del storage
  IF OLD.image_url IS NOT NULL AND OLD.image_url LIKE '%/products/%' THEN
    v_image_name := substring(OLD.image_url from '.*/products/(.*)$');
    
    IF v_image_name IS NOT NULL THEN
      BEGIN
        DELETE FROM storage.objects 
        WHERE bucket_id = 'products' AND name = v_image_name;
        
        RAISE NOTICE 'Imagen eliminada del storage: %', v_image_name;
        
      EXCEPTION
        WHEN OTHERS THEN
          RAISE WARNING 'No se pudo eliminar imagen del storage: % - %', v_image_name, SQLERRM;
      END;
    END IF;
  END IF;
  
  RETURN OLD;
END;
$$;

-- Crear trigger
DROP TRIGGER IF EXISTS trigger_cleanup_product_image ON products;
CREATE TRIGGER trigger_cleanup_product_image
  BEFORE DELETE ON products
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_product_image();

-- ===========================================
-- 9. VERIFICACIÓN FINAL
-- ===========================================

-- Verificar que no hay productos sin variantes
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM products p 
    WHERE NOT EXISTS (
      SELECT 1 FROM product_variants pv 
      WHERE pv.product_id = p.id
    )
  ) THEN
    RAISE WARNING 'Aún existen productos sin variantes';
  ELSE
    RAISE NOTICE 'Todos los productos tienen variantes';
  END IF;
END;
$$;

-- Verificar que no hay stock sin variantes
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM stock s 
    WHERE NOT EXISTS (
      SELECT 1 FROM product_variants pv 
      WHERE pv.id = s.variant_id
    )
  ) THEN
    RAISE WARNING 'Aún existe stock sin variantes';
  ELSE
    RAISE NOTICE 'Todo el stock tiene variantes válidas';
  END IF;
END;
$$;

-- Mostrar resumen de cambios
SELECT 
  'MIGRACIÓN COMPLETADA' as status,
  (SELECT COUNT(*) FROM products) as total_productos,
  (SELECT COUNT(*) FROM product_variants) as total_variantes,
  (SELECT COUNT(*) FROM stock) as total_stock,
  (SELECT COUNT(*) FROM stock WHERE quantity > 0) as stock_con_cantidad;


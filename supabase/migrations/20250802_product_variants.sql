-- MIGRACION: Agregar tabla product_variants y actualizar stock table

-- 1. Crear tabla product_variants
CREATE TABLE IF NOT EXISTS product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size text NOT NULL,
  price decimal(10,2) NOT NULL CHECK (price >= 0),
  created_at timestamptz DEFAULT now(),
  UNIQUE(product_id, size)
);

-- 2. Agregar columna variant_id a stock table
ALTER TABLE stock ADD COLUMN variant_id uuid REFERENCES product_variants(id) ON DELETE CASCADE;

-- 3. Migrar datos existentes (si hay productos con size y price)
-- Crear variantes para productos existentes
INSERT INTO product_variants (product_id, size, price)
SELECT id, size, price FROM products
ON CONFLICT (product_id, size) DO NOTHING;

-- 4. Actualizar stock table para usar variant_id
UPDATE stock 
SET variant_id = pv.id
FROM product_variants pv
WHERE stock.product_id = pv.product_id;

-- 5. Hacer variant_id NOT NULL después de migrar datos
ALTER TABLE stock ALTER COLUMN variant_id SET NOT NULL;

-- 6. Remover la columna product_id de stock (opcional, pero recomendado para consistencia)
-- ALTER TABLE stock DROP COLUMN product_id;

-- 7. Actualizar la constraint UNIQUE en stock
ALTER TABLE stock DROP CONSTRAINT IF EXISTS stock_product_id_branch_id_key;
ALTER TABLE stock ADD CONSTRAINT stock_variant_id_branch_id_key UNIQUE(variant_id, branch_id);

-- 8. Habilitar RLS en product_variants
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

-- 9. Crear políticas RLS para product_variants
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

-- 10. Actualizar políticas RLS para stock (si es necesario)
-- Las políticas existentes deberían seguir funcionando, pero puedes actualizarlas si es necesario

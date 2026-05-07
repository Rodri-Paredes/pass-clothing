-- ====================================================================================================
-- MIGRACIÓN: AGREGAR CAMPO DE NOTAS/DESCRIPCIÓN A VENTAS
-- Fecha: 2025-01-19
-- Descripción: Permite agregar descripciones personalizadas a las ventas (ej: giftcard, venta especial)
-- ====================================================================================================

-- Agregar columna notes a la tabla sales
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS notes text;

COMMENT ON COLUMN sales.notes IS 'Notas o descripción adicional de la venta (ej: giftcard, venta especial, etc.)';

-- Verificar que se agregó correctamente
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'sales' 
  AND column_name = 'notes';

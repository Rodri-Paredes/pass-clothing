-- MIGRACIÓN: SOLUCIÓN PARA DOBLE DESCUENTO DE STOCK
-- Fecha: 2025-01-14
-- Problema: El stock se está restando dos veces en cada venta
-- Solución: Crear trigger en BD para restar stock automáticamente

-- 1. CREAR FUNCIÓN PARA REDUCIR STOCK AUTOMÁTICAMENTE
CREATE OR REPLACE FUNCTION reduce_stock_on_sale()
RETURNS TRIGGER AS $$
BEGIN
  -- Reducir stock cuando se inserta un sale_item
  UPDATE stock
  SET 
    quantity = GREATEST(0, quantity - NEW.quantity),
    updated_at = now()
  WHERE variant_id = NEW.variant_id
    AND branch_id = (SELECT branch_id FROM sales WHERE id = NEW.sale_id);
  
  -- Verificar que se actualizó correctamente
  IF NOT FOUND THEN
    RAISE WARNING 'No se encontró stock para variant_id=% en la sucursal de la venta', NEW.variant_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. CREAR TRIGGER PARA EJECUTAR LA FUNCIÓN
DROP TRIGGER IF EXISTS trigger_reduce_stock_on_sale ON sale_items;
CREATE TRIGGER trigger_reduce_stock_on_sale
  AFTER INSERT ON sale_items
  FOR EACH ROW
  EXECUTE FUNCTION reduce_stock_on_sale();

-- 3. COMENTARIOS
COMMENT ON FUNCTION reduce_stock_on_sale() IS 
  'Reduce automáticamente el stock cuando se registra una venta';
COMMENT ON TRIGGER trigger_reduce_stock_on_sale ON sale_items IS 
  'Ejecuta la reducción de stock automáticamente al insertar items de venta';

-- 4. VERIFICAR QUE EL TRIGGER SE CREÓ CORRECTAMENTE
SELECT 
  tgname AS "Trigger",
  tgrelid::regclass AS "Tabla",
  pg_get_triggerdef(oid) AS "Definición"
FROM pg_trigger
WHERE tgname = 'trigger_reduce_stock_on_sale';

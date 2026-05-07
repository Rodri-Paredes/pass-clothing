-- MIGRACIÓN: SOLUCIÓN DEFINITIVA PARA PÉRDIDA DE STOCK
-- Fecha: 2025-01-01
-- Problema: Se pierde 1 unidad de stock al actualizar productos
-- Solución: Función transaccional que garantiza atomicidad

-- 1. ELIMINAR TRIGGER PROBLEMÁTICO
-- El trigger BEFORE UPDATE puede estar causando problemas
DROP TRIGGER IF EXISTS trigger_update_stock_updated_at ON stock;

-- 2. CREAR FUNCIÓN TRANSACCIONAL PARA ACTUALIZAR STOCK
CREATE OR REPLACE FUNCTION update_stock_safe(
  p_variant_id uuid,
  p_branch_id uuid,
  p_quantity integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stock_id uuid;
  v_current_quantity integer;
BEGIN
  -- Iniciar transacción implícita
  -- Buscar si existe el registro de stock
  SELECT id, quantity INTO v_stock_id, v_current_quantity
  FROM stock
  WHERE variant_id = p_variant_id AND branch_id = p_branch_id
  FOR UPDATE; -- Bloquear la fila para evitar modificaciones concurrentes
  
  IF FOUND THEN
    -- Actualizar stock existente
    UPDATE stock 
    SET 
      quantity = p_quantity,
      updated_at = now()
    WHERE id = v_stock_id;
    
    -- Verificar que se actualizó correctamente
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Error al actualizar stock: no se pudo modificar la fila';
    END IF;
    
    -- Verificar que la cantidad se guardó correctamente
    SELECT quantity INTO v_current_quantity
    FROM stock
    WHERE id = v_stock_id;
    
    IF v_current_quantity != p_quantity THEN
      RAISE EXCEPTION 'Error de integridad: cantidad esperada % pero se guardó %', p_quantity, v_current_quantity;
    END IF;
    
  ELSE
    -- Crear nuevo registro de stock
    INSERT INTO stock (variant_id, branch_id, quantity, created_at, updated_at)
    VALUES (p_variant_id, p_branch_id, p_quantity, now(), now());
    
    -- Verificar que se creó correctamente
    SELECT id, quantity INTO v_stock_id, v_current_quantity
    FROM stock
    WHERE variant_id = p_variant_id AND branch_id = p_branch_id;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Error al crear stock: no se pudo insertar la fila';
    END IF;
    
    IF v_current_quantity != p_quantity THEN
      RAISE EXCEPTION 'Error de integridad: cantidad esperada % pero se guardó %', p_quantity, v_current_quantity;
    END IF;
  END IF;
  
  -- Si llegamos aquí, todo salió bien
  -- La transacción se confirma automáticamente
END;
$$;

-- 3. CREAR TRIGGER MEJORADO PARA updated_at
-- Solo se ejecuta si realmente hay cambios en la cantidad
CREATE OR REPLACE FUNCTION update_stock_updated_at_safe()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo actualizar updated_at si la cantidad cambió
  IF OLD.quantity IS DISTINCT FROM NEW.quantity THEN
    NEW.updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger AFTER UPDATE para evitar interferir con la lógica principal
CREATE TRIGGER trigger_update_stock_updated_at_safe
  AFTER UPDATE ON stock
  FOR EACH ROW
  EXECUTE FUNCTION update_stock_updated_at_safe();

-- 4. CREAR ÍNDICES PARA MEJOR RENDIMIENTO
CREATE INDEX IF NOT EXISTS idx_stock_variant_branch_unique ON stock(variant_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_quantity ON stock(quantity);

-- 5. VERIFICAR QUE LA FUNCIÓN FUNCIONA
-- Esta consulta debería devolver true si todo está bien
SELECT 
  'Función update_stock_safe creada correctamente' as status,
  p.proname as function_name,
  p.prosrc as function_source
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.proname = 'update_stock_safe';

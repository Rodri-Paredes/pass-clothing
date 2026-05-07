-- Función para actualizar los movimientos de caja cuando se cambia el método de pago de una venta

-- 1. FUNCIÓN PARA ACTUALIZAR MOVIMIENTOS DE CAJA AL CAMBIAR MÉTODO DE PAGO
CREATE OR REPLACE FUNCTION update_cash_movements_on_payment_change()
RETURNS TRIGGER AS $$
DECLARE
  v_cash_register_id uuid;
  v_branch_id uuid;
  v_old_payment_details jsonb;
  v_new_payment_details jsonb;
  v_efectivo decimal(10,2);
  v_qr decimal(10,2);
  v_tarjeta decimal(10,2);
BEGIN
  -- Solo ejecutar si cambió el payment_type o payment_details
  IF OLD.payment_type = NEW.payment_type AND 
     (OLD.payment_details IS NOT DISTINCT FROM NEW.payment_details) THEN
    RETURN NEW;
  END IF;

  -- La sucursal ya está en NEW.branch_id, no necesitamos otra consulta
  v_branch_id := NEW.branch_id;
  
  -- Buscar la caja activa para la sucursal en la fecha de la venta
  -- Priorizar caja abierta, sino buscar la última cerrada del día de la venta
  SELECT id INTO v_cash_register_id 
  FROM cash_registers 
  WHERE branch_id = v_branch_id 
    AND status = 'ABIERTA'
  LIMIT 1;
  
  -- Si no hay caja abierta, buscar la caja del día de la venta
  IF v_cash_register_id IS NULL THEN
    SELECT id INTO v_cash_register_id 
    FROM cash_registers 
    WHERE branch_id = v_branch_id 
      AND DATE(opening_date) = DATE(NEW.sale_date)
    ORDER BY opening_date DESC
    LIMIT 1;
  END IF;
  
  -- Si hay una caja, actualizar los movimientos
  IF v_cash_register_id IS NOT NULL THEN
    -- 1. Eliminar los movimientos antiguos relacionados con esta venta
    DELETE FROM cash_movements 
    WHERE reference_id = NEW.id AND reference_type = 'SALE';
    
    -- 2. Crear nuevos movimientos según el nuevo método de pago
    IF NEW.payment_type = 'MIXTO' AND NEW.payment_details IS NOT NULL THEN
      -- Pago mixto - registrar cada método por separado
      v_efectivo := COALESCE((NEW.payment_details->>'efectivo')::decimal(10,2), 0);
      v_qr := COALESCE((NEW.payment_details->>'qr')::decimal(10,2), 0);
      v_tarjeta := COALESCE((NEW.payment_details->>'tarjeta')::decimal(10,2), 0);
      
      IF v_efectivo > 0 THEN
        INSERT INTO cash_movements (
          cash_register_id, movement_type, payment_type, amount, 
          description, reference_id, reference_type, user_id
        ) VALUES (
          v_cash_register_id, 'INGRESO', 'EFECTIVO', v_efectivo,
          'Venta #' || substring(NEW.id::text from 1 for 8) || ' (actualizado)',
          NEW.id, 'SALE', NEW.user_id
        );
      END IF;
      
      IF v_qr > 0 THEN
        INSERT INTO cash_movements (
          cash_register_id, movement_type, payment_type, amount, 
          description, reference_id, reference_type, user_id
        ) VALUES (
          v_cash_register_id, 'INGRESO', 'QR', v_qr,
          'Venta #' || substring(NEW.id::text from 1 for 8) || ' (actualizado)',
          NEW.id, 'SALE', NEW.user_id
        );
      END IF;
      
      IF v_tarjeta > 0 THEN
        INSERT INTO cash_movements (
          cash_register_id, movement_type, payment_type, amount, 
          description, reference_id, reference_type, user_id
        ) VALUES (
          v_cash_register_id, 'INGRESO', 'TARJETA', v_tarjeta,
          'Venta #' || substring(NEW.id::text from 1 for 8) || ' (actualizado)',
          NEW.id, 'SALE', NEW.user_id
        );
      END IF;
    ELSE
      -- Pago simple
      INSERT INTO cash_movements (
        cash_register_id, movement_type, payment_type, amount, 
        description, reference_id, reference_type, user_id
      ) VALUES (
        v_cash_register_id, 'INGRESO', NEW.payment_type, NEW.total,
        'Venta #' || substring(NEW.id::text from 1 for 8) || ' (actualizado)',
        NEW.id, 'SALE', NEW.user_id
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. CREAR TRIGGER PARA ACTUALIZAR MOVIMIENTOS AL CAMBIAR PAYMENT_TYPE
DROP TRIGGER IF EXISTS trigger_update_payment_method ON sales;

CREATE TRIGGER trigger_update_payment_method
  AFTER UPDATE OF payment_type, payment_details ON sales
  FOR EACH ROW
  WHEN (OLD.payment_type IS DISTINCT FROM NEW.payment_type OR 
        OLD.payment_details IS DISTINCT FROM NEW.payment_details)
  EXECUTE FUNCTION update_cash_movements_on_payment_change();

-- 3. COMENTARIOS
COMMENT ON FUNCTION update_cash_movements_on_payment_change() IS 
  'Actualiza automáticamente los movimientos de caja cuando se modifica el método de pago de una venta';

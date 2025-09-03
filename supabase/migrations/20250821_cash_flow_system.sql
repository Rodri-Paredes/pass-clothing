-- SISTEMA COMPLETO DE FLUJO DE CAJA
-- Migración para implementar apertura y cierre de caja

-- 1. TABLA DE CAJAS (CASH_REGISTERS)
CREATE TABLE cash_registers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  status text NOT NULL DEFAULT 'ABIERTA' CHECK (status IN ('ABIERTA', 'CERRADA')),
  
  -- Apertura de caja
  opening_date timestamptz NOT NULL DEFAULT now(),
  opening_amount decimal(10,2) NOT NULL CHECK (opening_amount >= 0),
  opening_user_id uuid NOT NULL REFERENCES users(id),
  opening_notes text,
  
  -- Cierre de caja
  closing_date timestamptz,
  closing_amount decimal(10,2) CHECK (closing_amount >= 0),
  closing_user_id uuid REFERENCES users(id),
  closing_notes text,
  
  -- Cálculos del sistema
  expected_cash decimal(10,2) DEFAULT 0,
  expected_qr decimal(10,2) DEFAULT 0,
  expected_card decimal(10,2) DEFAULT 0,
  expected_total decimal(10,2) DEFAULT 0,
  
  -- Diferencia (sobrante/faltante)
  cash_difference decimal(10,2) DEFAULT 0,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índice único parcial para asegurar solo una caja abierta por sucursal
CREATE UNIQUE INDEX idx_cash_registers_open_per_branch 
ON cash_registers (branch_id) 
WHERE status = 'ABIERTA';

-- 2. TABLA DE MOVIMIENTOS DE CAJA (CASH_MOVEMENTS)
CREATE TABLE cash_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_register_id uuid NOT NULL REFERENCES cash_registers(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN ('INGRESO', 'EGRESO')),
  payment_type text NOT NULL CHECK (payment_type IN ('EFECTIVO', 'QR', 'TARJETA', 'MIXTO')),
  amount decimal(10,2) NOT NULL CHECK (amount > 0),
  description text NOT NULL,
  reference_id uuid, -- ID de la venta o movimiento relacionado
  reference_type text, -- 'SALE', 'DEPOSIT', 'WITHDRAWAL', etc.
  user_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

-- 3. HABILITAR ROW LEVEL SECURITY
ALTER TABLE cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;

-- 4. POLÍTICAS RLS PARA CASH_REGISTERS
CREATE POLICY "Users can read cash registers for their branch"
  ON cash_registers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND (users.role = 'admin' OR users.branch_id = cash_registers.branch_id)
    )
  );

CREATE POLICY "Users can insert cash registers for their branch"
  ON cash_registers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND (users.role = 'admin' OR users.branch_id = cash_registers.branch_id)
    )
  );

CREATE POLICY "Users can update cash registers for their branch"
  ON cash_registers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND (users.role = 'admin' OR users.branch_id = cash_registers.branch_id)
    )
  );

-- 5. POLÍTICAS RLS PARA CASH_MOVEMENTS
CREATE POLICY "Users can read cash movements for their branch"
  ON cash_movements FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cash_registers cr
      JOIN users u ON u.id = auth.uid()
      WHERE cr.id = cash_movements.cash_register_id
      AND (u.role = 'admin' OR u.branch_id = cr.branch_id)
    )
  );

CREATE POLICY "Users can insert cash movements for their branch"
  ON cash_movements FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cash_registers cr
      JOIN users u ON u.id = auth.uid()
      WHERE cr.id = cash_movements.cash_register_id
      AND (u.role = 'admin' OR u.branch_id = cr.branch_id)
    )
  );

-- 6. FUNCIÓN PARA ABRIR CAJA
CREATE OR REPLACE FUNCTION open_cash_register(
  p_branch_id uuid,
  p_opening_amount decimal(10,2),
  p_opening_notes text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_cash_register_id uuid;
  v_user_id uuid;
BEGIN
  -- Obtener el usuario actual
  SELECT id INTO v_user_id FROM users WHERE id = auth.uid();
  
  -- Verificar que no haya una caja abierta en la sucursal
  IF EXISTS (
    SELECT 1 FROM cash_registers 
    WHERE branch_id = p_branch_id AND status = 'ABIERTA'
  ) THEN
    RAISE EXCEPTION 'Ya existe una caja abierta en esta sucursal';
  END IF;
  
  -- Crear la caja
  INSERT INTO cash_registers (
    branch_id, 
    user_id, 
    opening_amount, 
    opening_user_id, 
    opening_notes
  ) VALUES (
    p_branch_id, 
    v_user_id, 
    p_opening_amount, 
    v_user_id, 
    p_opening_notes
  ) RETURNING id INTO v_cash_register_id;
  
  -- Registrar el movimiento inicial
  INSERT INTO cash_movements (
    cash_register_id,
    movement_type,
    payment_type,
    amount,
    description,
    user_id
  ) VALUES (
    v_cash_register_id,
    'INGRESO',
    'EFECTIVO',
    p_opening_amount,
    'Apertura de caja - Fondo inicial',
    v_user_id
  );
  
  RETURN v_cash_register_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. FUNCIÓN PARA CERRAR CAJA
CREATE OR REPLACE FUNCTION close_cash_register(
  p_cash_register_id uuid,
  p_closing_amount decimal(10,2),
  p_closing_notes text DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_user_id uuid;
  v_expected_cash decimal(10,2);
  v_expected_qr decimal(10,2);
  v_expected_card decimal(10,2);
  v_expected_total decimal(10,2);
  v_cash_difference decimal(10,2);
BEGIN
  -- Obtener el usuario actual
  SELECT id INTO v_user_id FROM users WHERE id = auth.uid();
  
  -- Calcular montos esperados
  SELECT 
    COALESCE(SUM(CASE WHEN payment_type = 'EFECTIVO' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN payment_type = 'QR' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN payment_type = 'TARJETA' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(amount), 0)
  INTO v_expected_cash, v_expected_qr, v_expected_card, v_expected_total
  FROM cash_movements 
  WHERE cash_register_id = p_cash_register_id;
  
  -- Calcular diferencia
  v_cash_difference := p_closing_amount - v_expected_cash;
  
  -- Cerrar la caja
  UPDATE cash_registers SET
    status = 'CERRADA',
    closing_date = now(),
    closing_amount = p_closing_amount,
    closing_user_id = v_user_id,
    closing_notes = p_closing_notes,
    expected_cash = v_expected_cash,
    expected_qr = v_expected_qr,
    expected_card = v_expected_card,
    expected_total = v_expected_total,
    cash_difference = v_cash_difference,
    updated_at = now()
  WHERE id = p_cash_register_id;
  
  -- Registrar el movimiento de cierre
  INSERT INTO cash_movements (
    cash_register_id,
    movement_type,
    payment_type,
    amount,
    description,
    user_id
  ) VALUES (
    p_cash_register_id,
    'INGRESO',
    'EFECTIVO',
    p_closing_amount,
    'Cierre de caja - Conteo final',
    v_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. FUNCIÓN PARA REGISTRAR VENTA EN MOVIMIENTOS
CREATE OR REPLACE FUNCTION register_sale_movement(
  p_sale_id uuid
)
RETURNS void AS $$
DECLARE
  v_cash_register_id uuid;
  v_sale_total decimal(10,2);
  v_payment_type text;
  v_user_id uuid;
  v_branch_id uuid;
  v_payment_details jsonb;
  v_efectivo decimal(10,2);
  v_qr decimal(10,2);
  v_tarjeta decimal(10,2);
BEGIN
  -- Obtener datos de la venta
  SELECT 
    s.total, 
    s.payment_type, 
    s.user_id, 
    s.branch_id,
    s.payment_details
  INTO v_sale_total, v_payment_type, v_user_id, v_branch_id, v_payment_details
  FROM sales s
  WHERE s.id = p_sale_id;
  
  -- Obtener la caja abierta
  SELECT id INTO v_cash_register_id 
  FROM cash_registers 
  WHERE branch_id = v_branch_id AND status = 'ABIERTA';
  
  IF v_cash_register_id IS NULL THEN
    RAISE EXCEPTION 'No hay caja abierta en esta sucursal';
  END IF;
  
  -- Registrar movimiento según el tipo de pago
  IF v_payment_type = 'MIXTO' AND v_payment_details IS NOT NULL THEN
    -- Pago mixto - registrar cada método por separado
    v_efectivo := COALESCE((v_payment_details->>'efectivo')::decimal(10,2), 0);
    v_qr := COALESCE((v_payment_details->>'qr')::decimal(10,2), 0);
    v_tarjeta := COALESCE((v_payment_details->>'tarjeta')::decimal(10,2), 0);
    
    IF v_efectivo > 0 THEN
      INSERT INTO cash_movements (
        cash_register_id, movement_type, payment_type, amount, 
        description, reference_id, reference_type, user_id
      ) VALUES (
        v_cash_register_id, 'INGRESO', 'EFECTIVO', v_efectivo,
        'Venta #' || substring(p_sale_id::text from 1 for 8), p_sale_id, 'SALE', v_user_id
      );
    END IF;
    
    IF v_qr > 0 THEN
      INSERT INTO cash_movements (
        cash_register_id, movement_type, payment_type, amount, 
        description, reference_id, reference_type, user_id
      ) VALUES (
        v_cash_register_id, 'INGRESO', 'QR', v_qr,
        'Venta #' || substring(p_sale_id::text from 1 for 8), p_sale_id, 'SALE', v_user_id
      );
    END IF;
    
    IF v_tarjeta > 0 THEN
      INSERT INTO cash_movements (
        cash_register_id, movement_type, payment_type, amount, 
        description, reference_id, reference_type, user_id
      ) VALUES (
        v_cash_register_id, 'INGRESO', 'TARJETA', v_tarjeta,
        'Venta #' || substring(p_sale_id::text from 1 for 8), p_sale_id, 'SALE', v_user_id
      );
    END IF;
  ELSE
    -- Pago simple
    INSERT INTO cash_movements (
      cash_register_id, movement_type, payment_type, amount, 
      description, reference_id, reference_type, user_id
    ) VALUES (
      v_cash_register_id, 'INGRESO', v_payment_type, v_sale_total,
      'Venta #' || substring(p_sale_id::text from 1 for 8), p_sale_id, 'SALE', v_user_id
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. TRIGGER PARA REGISTRAR VENTAS AUTOMÁTICAMENTE
CREATE OR REPLACE FUNCTION trigger_register_sale_movement()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM register_sale_movement(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_register_sale_movement
  AFTER INSERT ON sales
  FOR EACH ROW
  EXECUTE FUNCTION trigger_register_sale_movement();

-- 10. FUNCIÓN PARA OBTENER RESUMEN DE CAJA
CREATE OR REPLACE FUNCTION get_cash_register_summary(p_cash_register_id uuid)
RETURNS TABLE (
  opening_amount decimal(10,2),
  expected_cash decimal(10,2),
  expected_qr decimal(10,2),
  expected_card decimal(10,2),
  expected_total decimal(10,2),
  closing_amount decimal(10,2),
  cash_difference decimal(10,2),
  total_sales integer,
  total_movements integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cr.opening_amount,
    cr.expected_cash,
    cr.expected_qr,
    cr.expected_card,
    cr.expected_total,
    cr.closing_amount,
    cr.cash_difference,
    COUNT(DISTINCT cm.reference_id) FILTER (WHERE cm.reference_type = 'SALE') as total_sales,
    COUNT(cm.id) as total_movements
  FROM cash_registers cr
  LEFT JOIN cash_movements cm ON cm.cash_register_id = cr.id
  WHERE cr.id = p_cash_register_id
  GROUP BY 
    cr.opening_amount, cr.expected_cash, cr.expected_qr, 
    cr.expected_card, cr.expected_total, cr.closing_amount, cr.cash_difference;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. FUNCIÓN PARA OBTENER MOVIMIENTOS DE CAJA
CREATE OR REPLACE FUNCTION get_cash_movements(p_cash_register_id uuid)
RETURNS TABLE (
  id uuid,
  movement_type text,
  payment_type text,
  amount decimal(10,2),
  description text,
  reference_id uuid,
  reference_type text,
  user_name text,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cm.id,
    cm.movement_type,
    cm.payment_type,
    cm.amount,
    cm.description,
    cm.reference_id,
    cm.reference_type,
    u.name as user_name,
    cm.created_at
  FROM cash_movements cm
  JOIN users u ON u.id = cm.user_id
  WHERE cm.cash_register_id = p_cash_register_id
  ORDER BY cm.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. ÍNDICES PARA MEJOR RENDIMIENTO
CREATE INDEX idx_cash_registers_branch_status ON cash_registers(branch_id, status);
CREATE INDEX idx_cash_registers_opening_date ON cash_registers(opening_date);
CREATE INDEX idx_cash_movements_register_id ON cash_movements(cash_register_id);
CREATE INDEX idx_cash_movements_created_at ON cash_movements(created_at);
CREATE INDEX idx_cash_movements_reference ON cash_movements(reference_id, reference_type);

-- 13. FUNCIÓN PARA OBTENER CAJA ABIERTA DE UNA SUCURSAL
CREATE OR REPLACE FUNCTION get_open_cash_register(p_branch_id uuid)
RETURNS TABLE (
  id uuid,
  opening_date timestamptz,
  opening_amount decimal(10,2),
  opening_user_name text,
  opening_notes text,
  expected_cash decimal(10,2),
  expected_qr decimal(10,2),
  expected_card decimal(10,2),
  expected_total decimal(10,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cr.id,
    cr.opening_date,
    cr.opening_amount,
    u.name as opening_user_name,
    cr.opening_notes,
    cr.expected_cash,
    cr.expected_qr,
    cr.expected_card,
    cr.expected_total
  FROM cash_registers cr
  JOIN users u ON u.id = cr.opening_user_id
  WHERE cr.branch_id = p_branch_id AND cr.status = 'ABIERTA';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 14. FUNCIÓN PARA OBTENER HISTORIAL DE CAJAS
CREATE OR REPLACE FUNCTION get_cash_register_history(p_branch_id uuid, p_start_date date, p_end_date date)
RETURNS TABLE (
  id uuid,
  opening_date timestamptz,
  closing_date timestamptz,
  opening_amount decimal(10,2),
  closing_amount decimal(10,2),
  expected_total decimal(10,2),
  cash_difference decimal(10,2),
  opening_user_name text,
  closing_user_name text,
  status text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cr.id,
    cr.opening_date,
    cr.closing_date,
    cr.opening_amount,
    cr.closing_amount,
    cr.expected_total,
    cr.cash_difference,
    ou.name as opening_user_name,
    cu.name as closing_user_name,
    cr.status
  FROM cash_registers cr
  JOIN users ou ON ou.id = cr.opening_user_id
  LEFT JOIN users cu ON cu.id = cr.closing_user_id
  WHERE cr.branch_id = p_branch_id 
    AND cr.opening_date::date BETWEEN p_start_date AND p_end_date
  ORDER BY cr.opening_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

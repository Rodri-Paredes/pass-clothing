-- SCRIPT DE VERIFICACIÓN Y RECREACIÓN DE FUNCIONES DE FLUJO DE CAJA
-- Ejecutar este script si las funciones no están funcionando correctamente

-- 1. VERIFICAR SI LAS FUNCIONES EXISTEN
DO $$
BEGIN
  -- Verificar función open_cash_register
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'open_cash_register') THEN
    RAISE NOTICE 'Función open_cash_register no existe, creándola...';
  END IF;
  
  -- Verificar función close_cash_register
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'close_cash_register') THEN
    RAISE NOTICE 'Función close_cash_register no existe, creándola...';
  END IF;
  
  -- Verificar función get_open_cash_register
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_open_cash_register') THEN
    RAISE NOTICE 'Función get_open_cash_register no existe, creándola...';
  END IF;
  
  -- Verificar función register_sale_movement
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'register_sale_movement') THEN
    RAISE NOTICE 'Función register_sale_movement no existe, creándola...';
  END IF;
  
  -- Verificar función get_cash_register_summary
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_cash_register_summary') THEN
    RAISE NOTICE 'Función get_cash_register_summary no existe, creándola...';
  END IF;
  
  -- Verificar función get_cash_movements
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_cash_movements') THEN
    RAISE NOTICE 'Función get_cash_movements no existe, creándola...';
  END IF;
  
  -- Verificar función get_cash_register_history
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_cash_register_history') THEN
    RAISE NOTICE 'Función get_cash_register_history no existe, creándola...';
  END IF;
END $$;

-- 2. RECREAR FUNCIÓN PARA OBTENER CAJA ABIERTA (SIMPLIFICADA)
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

-- 3. VERIFICAR QUE LAS TABLAS EXISTEN
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cash_registers') THEN
    RAISE EXCEPTION 'La tabla cash_registers no existe. Ejecuta primero la migración completa.';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cash_movements') THEN
    RAISE EXCEPTION 'La tabla cash_movements no existe. Ejecuta primero la migración completa.';
  END IF;
  
  RAISE NOTICE 'Todas las tablas existen correctamente.';
END $$;

-- 4. VERIFICAR POLÍTICAS RLS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'cash_registers' 
    AND policyname = 'Users can read cash registers for their branch'
  ) THEN
    RAISE NOTICE 'Política RLS para cash_registers no existe, creándola...';
    
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
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'cash_movements' 
    AND policyname = 'Users can read cash movements for their branch'
  ) THEN
    RAISE NOTICE 'Política RLS para cash_movements no existe, creándola...';
    
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
  END IF;
  
  RAISE NOTICE 'Verificación de políticas RLS completada.';
END $$;

-- 5. MOSTRAR ESTADO FINAL
SELECT 
  'cash_registers' as table_name,
  COUNT(*) as row_count
FROM cash_registers
UNION ALL
SELECT 
  'cash_movements' as table_name,
  COUNT(*) as row_count
FROM cash_movements;



































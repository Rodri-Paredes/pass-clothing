-- Permite corregir el método de pago sin abrir UPDATE directo sobre sales.
-- La función conserva las políticas RLS estrictas y autoriza únicamente al
-- personal de la misma sucursal (o a un administrador).

CREATE OR REPLACE FUNCTION public.update_sale_payment_method(
  p_sale_id uuid,
  p_payment_type text,
  p_payment_details jsonb DEFAULT NULL
)
RETURNS public.sales
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sale public.sales%ROWTYPE;
  v_payment_type text := upper(trim(p_payment_type));
  v_efectivo numeric := 0;
  v_qr numeric := 0;
  v_tarjeta numeric := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sesión no válida. Vuelve a iniciar sesión.' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_sale
  FROM public.sales
  WHERE id = p_sale_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venta no encontrada.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND (u.role = 'admin' OR u.branch_id = v_sale.branch_id)
  ) THEN
    RAISE EXCEPTION 'No tienes permiso para editar esta venta.' USING ERRCODE = '42501';
  END IF;

  IF v_payment_type IS NULL OR v_payment_type NOT IN ('EFECTIVO', 'QR', 'TARJETA', 'MIXTO') THEN
    RAISE EXCEPTION 'Método de pago inválido.' USING ERRCODE = '22023';
  END IF;

  IF v_payment_type = 'MIXTO' THEN
    IF p_payment_details IS NULL OR jsonb_typeof(p_payment_details) <> 'object' THEN
      RAISE EXCEPTION 'Debes ingresar el desglose del pago mixto.' USING ERRCODE = '22023';
    END IF;

    BEGIN
      v_efectivo := COALESCE((p_payment_details ->> 'efectivo')::numeric, 0);
      v_qr := COALESCE((p_payment_details ->> 'qr')::numeric, 0);
      v_tarjeta := COALESCE((p_payment_details ->> 'tarjeta')::numeric, 0);
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Los montos del pago mixto deben ser números válidos.' USING ERRCODE = '22023';
    END;

    IF v_efectivo < 0 OR v_qr < 0 OR v_tarjeta < 0 THEN
      RAISE EXCEPTION 'Los montos del pago mixto no pueden ser negativos.' USING ERRCODE = '22023';
    END IF;

    IF abs((v_efectivo + v_qr + v_tarjeta) - v_sale.total) > 0.01 THEN
      RAISE EXCEPTION 'La suma del pago mixto debe ser igual al total de la venta.' USING ERRCODE = '22023';
    END IF;

    p_payment_details := jsonb_build_object(
      'efectivo', v_efectivo,
      'qr', v_qr,
      'tarjeta', v_tarjeta
    );
  ELSE
    p_payment_details := NULL;
  END IF;

  UPDATE public.sales
  SET payment_type = v_payment_type,
      payment_details = p_payment_details,
      updated_at = now()
  WHERE id = p_sale_id
  RETURNING * INTO v_sale;

  RETURN v_sale;
END;
$$;

REVOKE ALL ON FUNCTION public.update_sale_payment_method(uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_sale_payment_method(uuid, text, jsonb) TO authenticated;

COMMENT ON FUNCTION public.update_sale_payment_method(uuid, text, jsonb) IS
  'Corrige el método de pago de una venta y deja que el trigger sincronice sus movimientos de caja.';

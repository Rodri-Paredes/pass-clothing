-- Crea el perfil web únicamente desde una sesión Auth.
-- Evita inserts directos desde el navegador cuando Supabase exige confirmar email.
CREATE OR REPLACE FUNCTION public.ensure_customer_profile(
  p_full_name text DEFAULT NULL,
  p_phone text DEFAULT NULL
)
RETURNS public.customer_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth AS $$
DECLARE
  v_customer public.customer_profiles%ROWTYPE;
  v_email text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticación requerida'; END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  IF NULLIF(trim(v_email), '') IS NULL THEN RAISE EXCEPTION 'La cuenta no tiene email'; END IF;

  SELECT * INTO v_customer
  FROM public.customer_profiles
  WHERE auth_user_id = auth.uid()
  FOR UPDATE;
  IF FOUND THEN RETURN v_customer; END IF;

  INSERT INTO public.customer_profiles(auth_user_id, first_name, full_name, email, phone)
  VALUES (
    auth.uid(),
    NULLIF(trim(p_full_name), ''),
    NULLIF(trim(p_full_name), ''),
    lower(trim(v_email)),
    NULLIF(trim(p_phone), '')
  )
  ON CONFLICT (auth_user_id) WHERE auth_user_id IS NOT NULL DO NOTHING
  RETURNING * INTO v_customer;

  IF v_customer.id IS NULL THEN
    SELECT * INTO v_customer FROM public.customer_profiles WHERE auth_user_id = auth.uid();
  END IF;
  RETURN v_customer;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_customer_profile(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_customer_profile(text, text) TO authenticated, service_role;

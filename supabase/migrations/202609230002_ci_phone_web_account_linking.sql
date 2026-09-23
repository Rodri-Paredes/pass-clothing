-- Vinculación segura de clientes web con perfiles creados desde POS/ERP.
-- No elimina datos ni reemplaza customer_code: el código queda interno.

ALTER TABLE public.customer_profiles
  ADD COLUMN IF NOT EXISTS ci text NULL,
  ADD COLUMN IF NOT EXISTS ci_normalized text NULL;

CREATE OR REPLACE FUNCTION public.normalize_customer_ci(p_ci text)
RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT NULLIF(upper(regexp_replace(trim(coalesce(p_ci, '')), '\s+', '', 'g')), '')
$$;

CREATE OR REPLACE FUNCTION public.normalize_customer_phone(p_phone text)
RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN length(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')) = 11
      AND left(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), 3) = '591'
      THEN right(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), 8)
    ELSE NULLIF(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), '')
  END
$$;

CREATE OR REPLACE FUNCTION public.prepare_customer_profile()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.auth_user_id IS NULL AND auth.uid() IS NOT NULL AND NEW.id = auth.uid() THEN
    NEW.auth_user_id := auth.uid();
  END IF;
  NEW.phone_normalized := public.normalize_customer_phone(NEW.phone);
  NEW.ci_normalized := public.normalize_customer_ci(NEW.ci);
  NEW.full_name := NULLIF(trim(COALESCE(NEW.full_name,
    concat_ws(' ', NULLIF(trim(NEW.first_name), ''), NULLIF(trim(NEW.last_name), '')))), '');
  IF TG_OP = 'UPDATE' AND OLD.customer_code IS NOT NULL AND trim(OLD.customer_code) <> '' THEN
    NEW.customer_code := OLD.customer_code;
  ELSIF NEW.customer_code IS NULL OR trim(NEW.customer_code) = '' THEN
    NEW.customer_code := 'PASS-' || lpad(nextval('public.customer_code_seq')::text, 6, '0');
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prepare_customer_profile ON public.customer_profiles;
CREATE TRIGGER trg_prepare_customer_profile
  BEFORE INSERT OR UPDATE OF first_name, last_name, full_name, phone, ci, customer_code
  ON public.customer_profiles FOR EACH ROW EXECUTE FUNCTION public.prepare_customer_profile();

UPDATE public.customer_profiles
SET ci_normalized = public.normalize_customer_ci(ci)
WHERE ci IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.customer_profiles
    WHERE ci_normalized IS NOT NULL
    GROUP BY ci_normalized HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'No se puede crear la unicidad de CI: existen perfiles duplicados';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_profiles_ci_normalized_unique
  ON public.customer_profiles (ci_normalized)
  WHERE ci_normalized IS NOT NULL;

DROP FUNCTION IF EXISTS public.search_customers(text, integer);
CREATE OR REPLACE FUNCTION public.search_customers(p_query text, p_limit integer DEFAULT 20)
RETURNS TABLE(id uuid, customer_code text, ci text, full_name text, phone text, email text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_query text := trim(COALESCE(p_query, ''));
  v_phone text := public.normalize_customer_phone(p_query);
  v_ci text := public.normalize_customer_ci(p_query);
BEGIN
  PERFORM public.crm_assert_staff();
  IF char_length(v_query) < 2 THEN RETURN; END IF;
  RETURN QUERY
  SELECT c.id, c.customer_code, c.ci,
    COALESCE(c.full_name, concat_ws(' ', c.first_name, c.last_name), 'Sin nombre'),
    c.phone, c.email
  FROM public.customer_profiles c
  WHERE c.deactivated_at IS NULL
    AND (c.full_name ILIKE '%' || v_query || '%'
      OR c.customer_code ILIKE '%' || v_query || '%'
      OR c.email ILIKE '%' || v_query || '%'
      OR c.phone_normalized LIKE '%' || v_phone || '%'
      OR c.ci_normalized = v_ci)
  ORDER BY CASE WHEN c.ci_normalized = v_ci OR c.phone_normalized = v_phone THEN 0 ELSE 1 END,
    c.full_name
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
END;
$$;

REVOKE ALL ON FUNCTION public.search_customers(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_customers(text, integer) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.crm_list_customers(text, integer, integer);
CREATE OR REPLACE FUNCTION public.crm_list_customers(
  p_query text DEFAULT NULL, p_page integer DEFAULT 1, p_page_size integer DEFAULT 25
)
RETURNS TABLE(
  id uuid, customer_code text, ci text, first_name text, last_name text, full_name text,
  phone text, email text, instagram text, created_at timestamptz, purchase_count bigint,
  total_spent numeric, last_purchase timestamptz, total_count bigint
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_query text := trim(COALESCE(p_query, ''));
  v_phone text := public.normalize_customer_phone(p_query);
  v_ci text := public.normalize_customer_ci(p_query);
  v_offset integer;
BEGIN
  IF NOT public.crm_is_admin() THEN RAISE EXCEPTION 'No autorizado'; END IF;
  v_offset := (GREATEST(COALESCE(p_page, 1), 1) - 1) * LEAST(GREATEST(COALESCE(p_page_size, 25), 1), 100);
  RETURN QUERY
  WITH filtered AS (
    SELECT c.* FROM public.customer_profiles c
    WHERE c.deactivated_at IS NULL AND (
      v_query = '' OR c.full_name ILIKE '%' || v_query || '%'
      OR c.customer_code ILIKE '%' || v_query || '%'
      OR c.email ILIKE '%' || v_query || '%'
      OR c.phone_normalized LIKE '%' || v_phone || '%'
      OR c.ci_normalized = v_ci
    )
  ), aggregates AS (
    SELECT s.customer_id, count(*)::bigint AS purchase_count,
      coalesce(sum(s.total), 0)::numeric AS total_spent, max(s.sale_date) AS last_purchase
    FROM public.sales s JOIN filtered c ON c.id = s.customer_id GROUP BY s.customer_id
  )
  SELECT c.id, c.customer_code, c.ci, c.first_name, c.last_name, c.full_name, c.phone,
    c.email, c.instagram, c.created_at, coalesce(a.purchase_count, 0),
    coalesce(a.total_spent, 0), a.last_purchase, count(*) OVER ()
  FROM filtered c LEFT JOIN aggregates a ON a.customer_id = c.id
  ORDER BY c.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_page_size, 25), 1), 100) OFFSET v_offset;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_customer(
  p_first_name text,
  p_last_name text DEFAULT NULL,
  p_ci text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_instagram text DEFAULT NULL
)
RETURNS public.customer_profiles
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  result public.customer_profiles;
  v_ci text := public.normalize_customer_ci(p_ci);
BEGIN
  PERFORM public.crm_assert_staff();
  IF NULLIF(trim(p_first_name), '') IS NULL OR v_ci IS NULL OR public.normalize_customer_phone(p_phone) IS NULL THEN
    RAISE EXCEPTION 'Nombre, CI y teléfono son obligatorios';
  END IF;
  IF EXISTS (SELECT 1 FROM public.customer_profiles WHERE ci_normalized = v_ci) THEN
    RAISE EXCEPTION 'Ya existe un cliente con este CI';
  END IF;
  IF EXISTS (SELECT 1 FROM public.customer_profiles WHERE phone_normalized = public.normalize_customer_phone(p_phone)) THEN
    RAISE EXCEPTION 'Ya existe un cliente con este teléfono';
  END IF;
  INSERT INTO public.customer_profiles(first_name, last_name, ci, phone, email, instagram)
  VALUES (NULLIF(trim(p_first_name), ''), NULLIF(trim(p_last_name), ''), NULLIF(trim(p_ci), ''),
    NULLIF(trim(p_phone), ''), NULLIF(lower(trim(p_email)), ''), NULLIF(trim(p_instagram), ''))
  RETURNING * INTO result;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.create_customer(text, text, text, text, text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.create_customer(text, text, text, text, text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.link_customer_profile_by_ci_phone(p_ci text, p_phone text)
RETURNS public.customer_profiles
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_customer public.customer_profiles;
  v_email text;
  v_ci text := public.normalize_customer_ci(p_ci);
  v_phone text := public.normalize_customer_phone(p_phone);
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticación requerida'; END IF;
  SELECT lower(trim(email)) INTO v_email FROM auth.users
  WHERE id = auth.uid() AND email_confirmed_at IS NOT NULL;
  IF v_email IS NULL THEN RAISE EXCEPTION 'Debes verificar tu email antes de vincular tu perfil de tienda'; END IF;
  SELECT * INTO v_customer FROM public.customer_profiles
  WHERE ci_normalized = v_ci AND phone_normalized = v_phone AND deactivated_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No pudimos vincular tu perfil de tienda con estos datos.'; END IF;
  IF EXISTS (SELECT 1 FROM public.customer_profiles WHERE auth_user_id = auth.uid() AND id <> v_customer.id) THEN
    RAISE EXCEPTION 'No pudimos vincular tu perfil de tienda con estos datos.';
  END IF;
  IF v_customer.auth_user_id IS NOT NULL AND v_customer.auth_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'No pudimos vincular tu perfil de tienda con estos datos.';
  END IF;
  IF v_customer.email IS NOT NULL AND lower(trim(v_customer.email)) <> v_email THEN
    RAISE EXCEPTION 'No pudimos vincular tu perfil de tienda con estos datos.';
  END IF;
  UPDATE public.customer_profiles
  SET auth_user_id = auth.uid(), email = COALESCE(email, v_email), updated_at = now()
  WHERE id = v_customer.id
  RETURNING * INTO v_customer;
  RETURN v_customer;
END;
$$;

REVOKE ALL ON FUNCTION public.link_customer_profile_by_ci_phone(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_customer_profile_by_ci_phone(text, text) TO authenticated, service_role;

-- PASS Clothing ERP — Fase 1: CRM, ventas con cliente y estadísticas.
-- Esta migración es aditiva. Verificar el esquema remoto antes de aplicarla:
--   * que public.users, sales, sale_items, products, product_variants, stock y branches
--     sean las tablas activas;
--   * que trigger_register_sale_movement exista sobre sales;
--   * que no exista un trigger que descuente stock al insertar sale_items.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Un perfil puede existir sin cuenta web. Si una versión previa de PASS Crew creó
-- customer_profiles con id = auth.users.id, se conserva cada id existente y se
-- desacopla la FK; los nuevos perfiles usan un UUID independiente.
CREATE TABLE IF NOT EXISTS public.customer_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  first_name text NULL,
  last_name text NULL,
  full_name text NULL,
  phone text NULL,
  phone_normalized text NULL,
  email text NULL,
  instagram text NULL,
  customer_code text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deactivated_at timestamptz NULL
);

ALTER TABLE public.customer_profiles ADD COLUMN IF NOT EXISTS auth_user_id uuid NULL;
ALTER TABLE public.customer_profiles ADD COLUMN IF NOT EXISTS first_name text NULL;
ALTER TABLE public.customer_profiles ADD COLUMN IF NOT EXISTS last_name text NULL;
ALTER TABLE public.customer_profiles ADD COLUMN IF NOT EXISTS full_name text NULL;
ALTER TABLE public.customer_profiles ADD COLUMN IF NOT EXISTS phone text NULL;
ALTER TABLE public.customer_profiles ADD COLUMN IF NOT EXISTS phone_normalized text NULL;
ALTER TABLE public.customer_profiles ADD COLUMN IF NOT EXISTS email text NULL;
ALTER TABLE public.customer_profiles ADD COLUMN IF NOT EXISTS instagram text NULL;
ALTER TABLE public.customer_profiles ADD COLUMN IF NOT EXISTS customer_code text NULL;
ALTER TABLE public.customer_profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.customer_profiles ADD COLUMN IF NOT EXISTS deactivated_at timestamptz NULL;
-- El prototipo de PASS Crew exigía full_name y email porque representaba una
-- cuenta web. El CRM permite clientes de mostrador sin esos datos.
ALTER TABLE public.customer_profiles ALTER COLUMN full_name DROP NOT NULL;
ALTER TABLE public.customer_profiles ALTER COLUMN email DROP NOT NULL;

-- Compatibilidad con el prototipo 1:1 de PASS Crew: los perfiles antiguos siguen
-- identificables, pero su vínculo de autenticación pasa a auth_user_id.
UPDATE public.customer_profiles
SET auth_user_id = id
WHERE auth_user_id IS NULL
  AND EXISTS (SELECT 1 FROM auth.users au WHERE au.id = customer_profiles.id);

DO $$
DECLARE fk_name text;
BEGIN
  SELECT c.conname INTO fk_name
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public' AND t.relname = 'customer_profiles'
    AND c.contype = 'f'
    AND pg_get_constraintdef(c.oid) LIKE '%REFERENCES auth.users(id)%'
    AND c.conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = t.oid AND attname = 'id')];
  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.customer_profiles DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

ALTER TABLE public.customer_profiles
  DROP CONSTRAINT IF EXISTS customer_profiles_auth_user_id_fkey;
ALTER TABLE public.customer_profiles
  ADD CONSTRAINT customer_profiles_auth_user_id_fkey
  FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE SEQUENCE IF NOT EXISTS public.customer_code_seq;

CREATE OR REPLACE FUNCTION public.normalize_customer_phone(p_phone text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT NULLIF(regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g'), '')
$$;

CREATE OR REPLACE FUNCTION public.prepare_customer_profile()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.phone_normalized := public.normalize_customer_phone(NEW.phone);
  NEW.full_name := NULLIF(trim(COALESCE(NEW.full_name,
    concat_ws(' ', NULLIF(trim(NEW.first_name), ''), NULLIF(trim(NEW.last_name), '')))), '');
  IF NEW.customer_code IS NULL OR trim(NEW.customer_code) = '' THEN
    NEW.customer_code := 'PASS-' || lpad(nextval('public.customer_code_seq')::text, 6, '0');
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prepare_customer_profile ON public.customer_profiles;
CREATE TRIGGER trg_prepare_customer_profile
  BEFORE INSERT OR UPDATE OF first_name, last_name, full_name, phone, customer_code
  ON public.customer_profiles FOR EACH ROW EXECUTE FUNCTION public.prepare_customer_profile();

-- Asigna códigos a perfiles históricos que no los tenían.
UPDATE public.customer_profiles
SET customer_code = 'PASS-' || lpad(nextval('public.customer_code_seq')::text, 6, '0')
WHERE customer_code IS NULL OR trim(customer_code) = '';

SELECT setval(
  'public.customer_code_seq',
  GREATEST(1, COALESCE((SELECT max(NULLIF(regexp_replace(customer_code, '^PASS-', ''), '')::bigint)
                         FROM public.customer_profiles WHERE customer_code ~ '^PASS-[0-9]+$'), 0)),
  EXISTS (SELECT 1 FROM public.customer_profiles WHERE customer_code ~ '^PASS-[0-9]+$')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_profiles_code
  ON public.customer_profiles (customer_code);
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_profiles_auth_user_id
  ON public.customer_profiles (auth_user_id) WHERE auth_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_profiles_phone_normalized
  ON public.customer_profiles (phone_normalized) WHERE phone_normalized IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_profiles_name_trgm
  ON public.customer_profiles USING gin (full_name gin_trgm_ops);

ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS customer_id uuid NULL
  REFERENCES public.customer_profiles(id) ON DELETE SET NULL;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS client_request_id uuid NULL;
CREATE INDEX IF NOT EXISTS idx_sales_customer_created_at
  ON public.sales (customer_id, created_at DESC) WHERE customer_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_client_request_id
  ON public.sales (client_request_id) WHERE client_request_id IS NOT NULL;

-- Los índices existentes ya cubren sales(branch_id, created_at) y sale_items(sale_id).

ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS customer_profiles_select_own_or_admin ON public.customer_profiles;
DROP POLICY IF EXISTS customer_profiles_insert_own ON public.customer_profiles;
DROP POLICY IF EXISTS customer_profiles_update_own_or_admin ON public.customer_profiles;
DROP POLICY IF EXISTS customer_profiles_no_direct_access ON public.customer_profiles;
CREATE POLICY customer_profiles_no_direct_access ON public.customer_profiles
  AS RESTRICTIVE FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.crm_is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
$$;

CREATE OR REPLACE FUNCTION public.crm_current_branch_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT branch_id FROM public.users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.crm_assert_staff()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.search_customers(p_query text, p_limit integer DEFAULT 20)
RETURNS TABLE(id uuid, customer_code text, full_name text, phone text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_query text := trim(COALESCE(p_query, ''));
BEGIN
  PERFORM public.crm_assert_staff();
  IF char_length(v_query) < 2 THEN RETURN; END IF;
  RETURN QUERY
  SELECT c.id, c.customer_code, COALESCE(c.full_name, concat_ws(' ', c.first_name, c.last_name), 'Sin nombre'), c.phone
  FROM public.customer_profiles c
  WHERE c.deactivated_at IS NULL
    AND (c.full_name ILIKE '%' || v_query || '%'
      OR c.customer_code ILIKE '%' || v_query || '%'
      OR c.phone_normalized LIKE '%' || public.normalize_customer_phone(v_query) || '%')
  ORDER BY CASE WHEN c.customer_code ILIKE v_query || '%' THEN 0 ELSE 1 END, c.full_name
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
END;
$$;

CREATE OR REPLACE FUNCTION public.crm_list_customers(p_query text DEFAULT NULL, p_page integer DEFAULT 1, p_page_size integer DEFAULT 25)
RETURNS TABLE(id uuid, customer_code text, first_name text, last_name text, full_name text, phone text, email text, instagram text, created_at timestamptz, purchase_count bigint, total_spent numeric, last_purchase timestamptz, total_count bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_query text := trim(COALESCE(p_query, '')); v_offset integer;
BEGIN
  IF NOT public.crm_is_admin() THEN RAISE EXCEPTION 'No autorizado'; END IF;
  v_offset := (GREATEST(COALESCE(p_page, 1), 1) - 1) * LEAST(GREATEST(COALESCE(p_page_size, 25), 1), 100);
  RETURN QUERY
  WITH filtered AS (
    SELECT c.* FROM public.customer_profiles c
    WHERE c.deactivated_at IS NULL AND (v_query = '' OR c.full_name ILIKE '%' || v_query || '%' OR c.customer_code ILIKE '%' || v_query || '%' OR c.phone_normalized LIKE '%' || public.normalize_customer_phone(v_query) || '%')
  ), aggregates AS (
    SELECT s.customer_id, count(*)::bigint AS purchase_count, coalesce(sum(s.total), 0)::numeric AS total_spent, max(s.sale_date) AS last_purchase
    FROM public.sales s JOIN filtered c ON c.id = s.customer_id GROUP BY s.customer_id
  )
  SELECT c.id, c.customer_code, c.first_name, c.last_name, c.full_name, c.phone, c.email, c.instagram, c.created_at,
    coalesce(a.purchase_count, 0), coalesce(a.total_spent, 0), a.last_purchase, count(*) OVER ()
  FROM filtered c LEFT JOIN aggregates a ON a.customer_id = c.id
  ORDER BY c.created_at DESC LIMIT LEAST(GREATEST(COALESCE(p_page_size, 25), 1), 100) OFFSET v_offset;
END;
$$;

CREATE OR REPLACE FUNCTION public.crm_customer_detail(p_customer_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.crm_is_admin() THEN RAISE EXCEPTION 'No autorizado'; END IF;
  SELECT jsonb_build_object('customer', to_jsonb(c), 'purchase_count', count(s.id), 'total_spent', coalesce(sum(s.total), 0), 'last_purchase', max(s.sale_date),
    'sales', coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'total', s.total, 'sale_date', s.sale_date, 'payment_type', s.payment_type) ORDER BY s.sale_date DESC) FILTER (WHERE s.id IS NOT NULL), '[]'::jsonb))
  INTO result FROM public.customer_profiles c LEFT JOIN public.sales s ON s.customer_id = c.id WHERE c.id = p_customer_id GROUP BY c.id;
  IF result IS NULL THEN RAISE EXCEPTION 'Cliente no encontrado'; END IF;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_customer(p_first_name text, p_last_name text DEFAULT NULL, p_phone text DEFAULT NULL, p_email text DEFAULT NULL, p_instagram text DEFAULT NULL)
RETURNS public.customer_profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result public.customer_profiles;
BEGIN
  PERFORM public.crm_assert_staff();
  INSERT INTO public.customer_profiles(first_name, last_name, phone, email, instagram)
  VALUES (NULLIF(trim(p_first_name), ''), NULLIF(trim(p_last_name), ''), NULLIF(trim(p_phone), ''), NULLIF(trim(p_email), ''), NULLIF(trim(p_instagram), ''))
  RETURNING * INTO result;
  RETURN result;
END;
$$;

-- Versión compatible: no reemplaza create_sale_atomic y mantiene el trigger de caja.
CREATE OR REPLACE FUNCTION public.create_sale_atomic_v2(
  p_branch_id uuid, p_user_id uuid, p_items jsonb, p_payment_type text,
  p_discount_amount numeric DEFAULT 0, p_payment_details jsonb DEFAULT NULL,
  p_notes text DEFAULT NULL, p_sale_channel text DEFAULT 'TIENDA',
  p_customer_id uuid DEFAULT NULL, p_client_request_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sale_id uuid; v_item jsonb; v_variant uuid; v_qty integer; v_price numeric; v_available integer;
  v_subtotal numeric := 0; v_total numeric; v_mixed_total numeric; v_rows integer; v_existing jsonb;
BEGIN
  PERFORM public.crm_assert_staff();
  IF p_user_id <> auth.uid() THEN RAISE EXCEPTION 'El usuario de la venta no coincide con la sesión'; END IF;
  IF NOT public.crm_is_admin() AND public.crm_current_branch_id() IS DISTINCT FROM p_branch_id THEN RAISE EXCEPTION 'No autorizado para esta sucursal'; END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'La venta requiere al menos un ítem'; END IF;
  IF p_client_request_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(p_client_request_id::text));
    SELECT jsonb_build_object('id', id, 'user_id', user_id, 'branch_id', branch_id, 'customer_id', customer_id, 'subtotal', subtotal, 'discount_amount', discount_amount, 'total', total, 'sale_date', sale_date, 'payment_type', payment_type, 'payment_details', payment_details, 'notes', notes, 'sale_channel', sale_channel, 'created_at', created_at) INTO v_existing FROM public.sales WHERE client_request_id = p_client_request_id;
    IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
  END IF;
  IF p_customer_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.customer_profiles WHERE id = p_customer_id AND deactivated_at IS NULL) THEN RAISE EXCEPTION 'Cliente inválido o desactivado'; END IF;
  IF p_payment_type NOT IN ('EFECTIVO', 'QR', 'TARJETA', 'MIXTO') THEN RAISE EXCEPTION 'Método de pago inválido'; END IF;
  IF p_sale_channel NOT IN ('TIENDA', 'WEB') THEN RAISE EXCEPTION 'Canal de venta inválido'; END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_variant := (v_item->>'variantId')::uuid; v_qty := (v_item->>'quantity')::integer; v_price := (v_item->>'unitPrice')::numeric;
    IF v_qty IS NULL OR v_qty <= 0 OR v_price IS NULL OR v_price <= 0 THEN RAISE EXCEPTION 'Ítem inválido'; END IF;
    SELECT quantity INTO v_available FROM public.stock WHERE variant_id = v_variant AND branch_id = p_branch_id FOR UPDATE;
    IF NOT FOUND OR v_available < v_qty THEN RAISE EXCEPTION 'Stock insuficiente para la variante %', v_variant; END IF;
    v_subtotal := v_subtotal + (v_qty * v_price);
  END LOOP;
  IF COALESCE(p_discount_amount, 0) < 0 OR COALESCE(p_discount_amount, 0) > v_subtotal THEN RAISE EXCEPTION 'Descuento inválido'; END IF;
  v_total := v_subtotal - COALESCE(p_discount_amount, 0);
  IF p_payment_type = 'MIXTO' THEN
    v_mixed_total := coalesce((p_payment_details->>'efectivo')::numeric, 0) + coalesce((p_payment_details->>'qr')::numeric, 0) + coalesce((p_payment_details->>'tarjeta')::numeric, 0);
    IF p_payment_details IS NULL OR v_mixed_total < 0 OR abs(v_mixed_total - v_total) > 0.01 THEN RAISE EXCEPTION 'El pago mixto no coincide con el total'; END IF;
  END IF;
  INSERT INTO public.sales(user_id, branch_id, customer_id, client_request_id, subtotal, discount_amount, total, sale_date, payment_type, payment_details, notes, sale_channel)
  VALUES (p_user_id, p_branch_id, p_customer_id, p_client_request_id, v_subtotal, coalesce(p_discount_amount, 0), v_total, now(), p_payment_type, p_payment_details, nullif(trim(p_notes), ''), p_sale_channel) RETURNING id INTO v_sale_id;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_variant := (v_item->>'variantId')::uuid; v_qty := (v_item->>'quantity')::integer; v_price := (v_item->>'unitPrice')::numeric;
    INSERT INTO public.sale_items(sale_id, variant_id, quantity, unit_price, subtotal) VALUES (v_sale_id, v_variant, v_qty, v_price, v_qty * v_price);
    UPDATE public.stock SET quantity = quantity - v_qty, updated_at = now() WHERE variant_id = v_variant AND branch_id = p_branch_id AND quantity >= v_qty;
    GET DIAGNOSTICS v_rows = ROW_COUNT; IF v_rows = 0 THEN RAISE EXCEPTION 'No se pudo decrementar stock'; END IF;
  END LOOP;
  SELECT jsonb_build_object('id', id, 'user_id', user_id, 'branch_id', branch_id, 'customer_id', customer_id, 'subtotal', subtotal, 'discount_amount', discount_amount, 'total', total, 'sale_date', sale_date, 'payment_type', payment_type, 'payment_details', payment_details, 'notes', notes, 'sale_channel', sale_channel, 'created_at', created_at) INTO v_existing FROM public.sales WHERE id = v_sale_id;
  RETURN v_existing;
END;
$$;

CREATE OR REPLACE FUNCTION public.sales_units_breakdown(p_dimension text, p_start_at timestamptz, p_end_at timestamptz, p_branch_id uuid DEFAULT NULL, p_top_n integer DEFAULT 10)
RETURNS TABLE(label text, units bigint, percentage numeric) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.crm_assert_staff();
  IF NOT public.crm_is_admin() AND (p_branch_id IS NULL OR public.crm_current_branch_id() IS DISTINCT FROM p_branch_id) THEN RAISE EXCEPTION 'No autorizado para estas estadísticas'; END IF;
  IF p_dimension NOT IN ('category', 'size') OR p_start_at IS NULL OR p_end_at IS NULL OR p_start_at >= p_end_at THEN RAISE EXCEPTION 'Parámetros inválidos'; END IF;
  RETURN QUERY EXECUTE format($sql$
    WITH grouped AS (SELECT coalesce(nullif(trim(%1$s), ''), 'Sin clasificar') AS label, sum(si.quantity)::bigint AS units
      FROM public.sales s JOIN public.sale_items si ON si.sale_id = s.id
      JOIN public.product_variants v ON v.id = si.variant_id JOIN public.products p ON p.id = v.product_id
      WHERE s.sale_date >= $1 AND s.sale_date < $2 AND ($3 IS NULL OR s.branch_id = $3) GROUP BY 1),
    ranked AS (SELECT label, units, sum(units) OVER () AS total_units, row_number() OVER (ORDER BY units DESC, label) AS rn FROM grouped),
    folded AS (SELECT CASE WHEN rn <= $4 THEN label ELSE 'Otros' END AS label, sum(units)::bigint AS units, max(total_units) AS total_units FROM ranked GROUP BY 1)
    SELECT label, units, round((units::numeric / nullif(total_units, 0)) * 100, 2) FROM folded ORDER BY units DESC, label
  $sql$, CASE WHEN p_dimension = 'category' THEN 'p.category' ELSE 'v.size' END) USING p_start_at, p_end_at, p_branch_id, LEAST(GREATEST(COALESCE(p_top_n, 10), 1), 100);
END;
$$;

REVOKE ALL ON FUNCTION public.search_customers(text, integer), public.crm_list_customers(text, integer, integer), public.crm_customer_detail(uuid), public.create_customer(text, text, text, text, text), public.create_sale_atomic_v2(uuid, uuid, jsonb, text, numeric, jsonb, text, text, uuid, uuid), public.sales_units_breakdown(text, timestamptz, timestamptz, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_customers(text, integer), public.create_customer(text, text, text, text, text), public.create_sale_atomic_v2(uuid, uuid, jsonb, text, numeric, jsonb, text, text, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_list_customers(text, integer, integer), public.crm_customer_detail(uuid), public.sales_units_breakdown(text, timestamptz, timestamptz, uuid, integer) TO authenticated;

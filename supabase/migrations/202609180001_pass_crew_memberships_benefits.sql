-- PASS Crew: membresías, solicitudes, beneficios y aplicación segura en ventas.
-- Requiere Fase 1 CRM (customer_profiles + create_sale_atomic_v2).

CREATE TABLE public.crew_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  price numeric(10,2) NOT NULL CHECK (price >= 0),
  currency text NOT NULL DEFAULT 'BOB',
  duration_months integer NOT NULL CHECK (duration_months > 0),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.crew_plans (code, name, price, duration_months, sort_order)
VALUES
  ('SEMESTRAL', 'Semestral', 199, 6, 10),
  ('ANUAL', 'Anual', 349, 12, 20)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE public.crew_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  payment_qr_path text,
  payment_instructions text,
  updated_by uuid REFERENCES public.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.crew_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE public.crew_benefit_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  benefit_type text NOT NULL CHECK (benefit_type IN (
    'percentage_discount', 'fixed_discount', 'product_discount',
    'category_discount', 'drop_discount', 'manual', 'crew_plan'
  )),
  rule jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(rule) = 'object'),
  is_active boolean NOT NULL DEFAULT true,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.crew_plan_benefits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.crew_plans(id) ON DELETE CASCADE,
  benefit_id uuid NOT NULL REFERENCES public.crew_benefit_definitions(id) ON DELETE RESTRICT,
  priority integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  valid_from timestamptz,
  valid_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, benefit_id),
  CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until > valid_from)
);

CREATE SEQUENCE public.crew_request_number_seq;
CREATE SEQUENCE public.crew_member_number_seq;

CREATE FUNCTION public.generate_crew_request_number() RETURNS text
LANGUAGE sql SET search_path = public AS $$
  SELECT 'PASSCREW-' || to_char(now() AT TIME ZONE 'America/La_Paz', 'YYYY') || '-' || lpad(nextval('public.crew_request_number_seq')::text, 6, '0')
$$;

CREATE FUNCTION public.generate_crew_member_number() RETURNS text
LANGUAGE sql SET search_path = public AS $$
  SELECT 'CREW-' || lpad(nextval('public.crew_member_number_seq')::text, 6, '0')
$$;

CREATE TABLE public.crew_membership_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number text NOT NULL UNIQUE DEFAULT public.generate_crew_request_number(),
  customer_id uuid NOT NULL REFERENCES public.customer_profiles(id) ON DELETE RESTRICT,
  plan_id uuid NOT NULL REFERENCES public.crew_plans(id) ON DELETE RESTRICT,
  plan_code_snapshot text NOT NULL,
  plan_name_snapshot text NOT NULL,
  price_snapshot numeric(10,2) NOT NULL CHECK (price_snapshot >= 0),
  currency_snapshot text NOT NULL,
  duration_months_snapshot integer NOT NULL CHECK (duration_months_snapshot > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'cancelled')),
  receipt_path text,
  rejection_reason text,
  reviewed_by uuid REFERENCES public.users(id),
  reviewed_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX crew_requests_one_open_per_customer ON public.crew_membership_requests(customer_id) WHERE status IN ('draft', 'pending');
CREATE INDEX crew_requests_status_created_idx ON public.crew_membership_requests(status, created_at DESC);

CREATE TABLE public.crew_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_number text NOT NULL DEFAULT public.generate_crew_member_number(),
  customer_id uuid NOT NULL REFERENCES public.customer_profiles(id) ON DELETE RESTRICT,
  plan_id uuid NOT NULL REFERENCES public.crew_plans(id) ON DELETE RESTRICT,
  source_request_id uuid NOT NULL UNIQUE REFERENCES public.crew_membership_requests(id) ON DELETE RESTRICT,
  plan_code_snapshot text NOT NULL,
  plan_name_snapshot text NOT NULL,
  price_snapshot numeric(10,2) NOT NULL,
  currency_snapshot text NOT NULL,
  duration_months_snapshot integer NOT NULL,
  status text NOT NULL CHECK (status IN ('scheduled', 'active', 'expired', 'cancelled', 'inactive')),
  started_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > started_at)
);
CREATE UNIQUE INDEX crew_memberships_one_active ON public.crew_memberships(customer_id) WHERE status = 'active';
CREATE UNIQUE INDEX crew_memberships_one_scheduled ON public.crew_memberships(customer_id) WHERE status = 'scheduled';
CREATE INDEX crew_memberships_customer_history_idx ON public.crew_memberships(customer_id, started_at DESC);
CREATE INDEX crew_memberships_expiry_idx ON public.crew_memberships(status, expires_at);

CREATE TABLE public.crew_membership_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customer_profiles(id) ON DELETE RESTRICT,
  request_id uuid REFERENCES public.crew_membership_requests(id) ON DELETE RESTRICT,
  membership_id uuid REFERENCES public.crew_memberships(id) ON DELETE RESTRICT,
  action text NOT NULL,
  performed_by uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crew_audit_customer_created_idx ON public.crew_membership_audit_log(customer_id, created_at DESC);

CREATE TABLE public.sale_benefit_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL UNIQUE REFERENCES public.sales(id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL REFERENCES public.customer_profiles(id) ON DELETE RESTRICT,
  membership_id uuid REFERENCES public.crew_memberships(id) ON DELETE RESTRICT,
  benefit_id uuid REFERENCES public.crew_benefit_definitions(id) ON DELETE RESTRICT,
  source text NOT NULL CHECK (source IN ('crew', 'manual', 'catalog_promotion')),
  benefit_snapshot jsonb NOT NULL,
  discount_amount numeric(10,2) NOT NULL CHECK (discount_amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sale_benefit_customer_idx ON public.sale_benefit_redemptions(customer_id, created_at DESC);

CREATE FUNCTION public.crew_set_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  IF TG_TABLE_NAME = 'crew_settings' THEN NEW.updated_by = auth.uid(); END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER crew_plans_updated_at BEFORE UPDATE ON public.crew_plans FOR EACH ROW EXECUTE FUNCTION public.crew_set_updated_at();
CREATE TRIGGER crew_settings_updated_at BEFORE UPDATE ON public.crew_settings FOR EACH ROW EXECUTE FUNCTION public.crew_set_updated_at();
CREATE TRIGGER crew_benefit_definitions_updated_at BEFORE UPDATE ON public.crew_benefit_definitions FOR EACH ROW EXECUTE FUNCTION public.crew_set_updated_at();
CREATE TRIGGER crew_plan_benefits_updated_at BEFORE UPDATE ON public.crew_plan_benefits FOR EACH ROW EXECUTE FUNCTION public.crew_set_updated_at();
CREATE TRIGGER crew_requests_updated_at BEFORE UPDATE ON public.crew_membership_requests FOR EACH ROW EXECUTE FUNCTION public.crew_set_updated_at();
CREATE TRIGGER crew_memberships_updated_at BEFORE UPDATE ON public.crew_memberships FOR EACH ROW EXECUTE FUNCTION public.crew_set_updated_at();

CREATE FUNCTION public.crew_is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
$$;

CREATE FUNCTION public.crew_is_staff() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'vendedor'))
$$;

CREATE FUNCTION public.crew_owns_customer(p_customer_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.customer_profiles WHERE id = p_customer_id AND auth_user_id = auth.uid())
$$;

ALTER TABLE public.crew_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crew_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crew_benefit_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crew_plan_benefits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crew_membership_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crew_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crew_membership_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_benefit_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY crew_plans_public_active ON public.crew_plans FOR SELECT TO anon, authenticated USING (is_active OR public.crew_is_admin());
CREATE POLICY crew_plans_admin_manage ON public.crew_plans FOR ALL TO authenticated USING (public.crew_is_admin()) WITH CHECK (public.crew_is_admin());
CREATE POLICY crew_settings_authenticated_read ON public.crew_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY crew_settings_admin_manage ON public.crew_settings FOR ALL TO authenticated USING (public.crew_is_admin()) WITH CHECK (public.crew_is_admin());
CREATE POLICY crew_benefits_public_read ON public.crew_benefit_definitions FOR SELECT TO anon, authenticated USING ((is_active AND is_public) OR public.crew_is_admin());
CREATE POLICY crew_benefits_admin_manage ON public.crew_benefit_definitions FOR ALL TO authenticated USING (public.crew_is_admin()) WITH CHECK (public.crew_is_admin());
CREATE POLICY crew_plan_benefits_public_read ON public.crew_plan_benefits FOR SELECT TO anon, authenticated USING (is_active OR public.crew_is_admin());
CREATE POLICY crew_plan_benefits_admin_manage ON public.crew_plan_benefits FOR ALL TO authenticated USING (public.crew_is_admin()) WITH CHECK (public.crew_is_admin());
CREATE POLICY crew_requests_own_or_admin_read ON public.crew_membership_requests FOR SELECT TO authenticated USING (public.crew_owns_customer(customer_id) OR public.crew_is_admin());
CREATE POLICY crew_memberships_own_or_admin_read ON public.crew_memberships FOR SELECT TO authenticated USING (public.crew_owns_customer(customer_id) OR public.crew_is_admin());
CREATE POLICY crew_memberships_admin_manage ON public.crew_memberships FOR ALL TO authenticated USING (public.crew_is_admin()) WITH CHECK (public.crew_is_admin());
CREATE POLICY crew_audit_own_or_admin_read ON public.crew_membership_audit_log FOR SELECT TO authenticated USING (public.crew_owns_customer(customer_id) OR public.crew_is_admin());
CREATE POLICY sale_benefit_staff_read ON public.sale_benefit_redemptions FOR SELECT TO authenticated USING (public.crew_is_staff());

REVOKE ALL ON public.crew_plans, public.crew_settings, public.crew_benefit_definitions, public.crew_plan_benefits,
  public.crew_membership_requests, public.crew_memberships, public.crew_membership_audit_log, public.sale_benefit_redemptions FROM anon, authenticated;
GRANT SELECT ON public.crew_plans, public.crew_benefit_definitions, public.crew_plan_benefits TO anon, authenticated;
GRANT SELECT ON public.crew_settings, public.crew_membership_requests, public.crew_memberships, public.crew_membership_audit_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crew_plans, public.crew_settings, public.crew_benefit_definitions, public.crew_plan_benefits TO authenticated;
GRANT SELECT ON public.sale_benefit_redemptions TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('crew-receipts', 'crew-receipts', false, 10485760, ARRAY['image/jpeg','image/png','image/webp','application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('crew-assets', 'crew-assets', false, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY crew_receipts_insert_own ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'crew-receipts'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.crew_membership_requests r
    JOIN public.customer_profiles c ON c.id = r.customer_id
    WHERE r.id::text = (storage.foldername(name))[2] AND c.auth_user_id = auth.uid() AND r.status = 'draft'
  )
);
CREATE POLICY crew_receipts_read_own_or_admin ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'crew-receipts' AND (
    (storage.foldername(name))[1] = auth.uid()::text OR public.crew_is_admin()
  )
);
CREATE POLICY crew_assets_admin_manage ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'crew-assets' AND public.crew_is_admin()) WITH CHECK (bucket_id = 'crew-assets' AND public.crew_is_admin());
CREATE POLICY crew_assets_authenticated_read ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'crew-assets');

CREATE FUNCTION public.create_crew_membership_request(p_plan_id uuid) RETURNS public.crew_membership_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, storage AS $$
DECLARE v_customer public.customer_profiles%ROWTYPE; v_plan public.crew_plans%ROWTYPE; v_request public.crew_membership_requests%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticación requerida'; END IF;
  SELECT * INTO v_customer FROM public.customer_profiles WHERE auth_user_id = auth.uid() AND deactivated_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil de cliente no encontrado'; END IF;
  SELECT * INTO v_plan FROM public.crew_plans WHERE id = p_plan_id AND is_active FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan no disponible'; END IF;
  IF EXISTS (SELECT 1 FROM public.crew_membership_requests WHERE customer_id = v_customer.id AND status IN ('draft','pending')) THEN RAISE EXCEPTION 'Ya existe una solicitud abierta'; END IF;
  INSERT INTO public.crew_membership_requests (
    customer_id, plan_id, plan_code_snapshot, plan_name_snapshot, price_snapshot, currency_snapshot, duration_months_snapshot
  ) VALUES (v_customer.id, v_plan.id, v_plan.code, v_plan.name, v_plan.price, v_plan.currency, v_plan.duration_months)
  RETURNING * INTO v_request;
  RETURN v_request;
END
$$;

CREATE FUNCTION public.submit_crew_receipt(p_request_id uuid, p_receipt_path text) RETURNS public.crew_membership_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, storage AS $$
DECLARE v_request public.crew_membership_requests%ROWTYPE; v_customer public.customer_profiles%ROWTYPE;
BEGIN
  SELECT r.* INTO v_request FROM public.crew_membership_requests r JOIN public.customer_profiles c ON c.id = r.customer_id
  WHERE r.id = p_request_id AND c.auth_user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND OR v_request.status <> 'draft' THEN RAISE EXCEPTION 'Solicitud no disponible para envío'; END IF;
  SELECT * INTO v_customer FROM public.customer_profiles WHERE id = v_request.customer_id;
  IF p_receipt_path !~ ('^' || auth.uid()::text || '/' || p_request_id::text || '/') THEN RAISE EXCEPTION 'Ruta de comprobante inválida'; END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'crew-receipts' AND name = p_receipt_path) THEN RAISE EXCEPTION 'Comprobante no encontrado'; END IF;
  UPDATE public.crew_membership_requests SET receipt_path = p_receipt_path, status = 'pending', submitted_at = now() WHERE id = p_request_id RETURNING * INTO v_request;
  INSERT INTO public.crew_membership_audit_log(customer_id, request_id, action, performed_by, metadata)
  VALUES (v_request.customer_id, v_request.id, 'request_submitted', auth.uid(), jsonb_build_object('plan_code', v_request.plan_code_snapshot, 'price', v_request.price_snapshot));
  RETURN v_request;
END
$$;

CREATE FUNCTION public.crew_refresh_membership_statuses() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.crew_memberships SET status = 'expired' WHERE status = 'active' AND expires_at <= now();
  UPDATE public.crew_memberships m SET status = 'active'
  WHERE m.status = 'scheduled' AND m.started_at <= now()
    AND NOT EXISTS (SELECT 1 FROM public.crew_memberships a WHERE a.customer_id = m.customer_id AND a.status = 'active' AND a.id <> m.id);
END
$$;

CREATE FUNCTION public.approve_crew_request(p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_request public.crew_membership_requests%ROWTYPE; v_active public.crew_memberships%ROWTYPE; v_membership public.crew_memberships%ROWTYPE; v_start timestamptz; v_status text;
BEGIN
  IF NOT public.crew_is_admin() THEN RAISE EXCEPTION 'Solo administradores pueden aprobar solicitudes'; END IF;
  PERFORM public.crew_refresh_membership_statuses();
  SELECT * INTO v_request FROM public.crew_membership_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND OR v_request.status <> 'pending' OR v_request.receipt_path IS NULL THEN RAISE EXCEPTION 'Solicitud pendiente válida no encontrada'; END IF;
  IF EXISTS (SELECT 1 FROM public.crew_memberships WHERE customer_id = v_request.customer_id AND status = 'scheduled') THEN RAISE EXCEPTION 'El cliente ya tiene una renovación programada'; END IF;
  SELECT * INTO v_active FROM public.crew_memberships WHERE customer_id = v_request.customer_id AND status = 'active' FOR UPDATE;
  IF FOUND THEN v_start := v_active.expires_at; v_status := 'scheduled'; ELSE v_start := now(); v_status := 'active'; END IF;
  INSERT INTO public.crew_memberships (member_number, customer_id, plan_id, source_request_id, plan_code_snapshot, plan_name_snapshot, price_snapshot, currency_snapshot, duration_months_snapshot, status, started_at, expires_at)
  VALUES (COALESCE(v_active.member_number, public.generate_crew_member_number()), v_request.customer_id, v_request.plan_id, v_request.id, v_request.plan_code_snapshot, v_request.plan_name_snapshot, v_request.price_snapshot, v_request.currency_snapshot, v_request.duration_months_snapshot, v_status, v_start, v_start + make_interval(months => v_request.duration_months_snapshot))
  RETURNING * INTO v_membership;
  UPDATE public.crew_membership_requests SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now() WHERE id = v_request.id;
  INSERT INTO public.crew_membership_audit_log(customer_id, request_id, membership_id, action, performed_by, metadata)
  VALUES (v_request.customer_id, v_request.id, v_membership.id, CASE WHEN v_status = 'scheduled' THEN 'renewal_scheduled' ELSE 'membership_activated' END, auth.uid(), jsonb_build_object('started_at', v_membership.started_at, 'expires_at', v_membership.expires_at, 'plan', v_membership.plan_code_snapshot));
  RETURN jsonb_build_object('request_id', v_request.id, 'membership_id', v_membership.id, 'member_number', v_membership.member_number, 'status', v_membership.status, 'started_at', v_membership.started_at, 'expires_at', v_membership.expires_at);
END
$$;

CREATE FUNCTION public.reject_crew_request(p_request_id uuid, p_reason text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_request public.crew_membership_requests%ROWTYPE;
BEGIN
  IF NOT public.crew_is_admin() THEN RAISE EXCEPTION 'Solo administradores pueden rechazar solicitudes'; END IF;
  IF length(COALESCE(p_reason, '')) > 500 THEN RAISE EXCEPTION 'El motivo no puede superar 500 caracteres'; END IF;
  SELECT * INTO v_request FROM public.crew_membership_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND OR v_request.status <> 'pending' THEN RAISE EXCEPTION 'Solicitud pendiente no encontrada'; END IF;
  UPDATE public.crew_membership_requests SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), rejection_reason = nullif(trim(p_reason), '') WHERE id = p_request_id;
  INSERT INTO public.crew_membership_audit_log(customer_id, request_id, action, performed_by, metadata)
  VALUES (v_request.customer_id, v_request.id, 'request_rejected', auth.uid(), jsonb_build_object('reason', nullif(trim(p_reason), '')));
  RETURN jsonb_build_object('request_id', v_request.id, 'status', 'rejected');
END
$$;

CREATE FUNCTION public.get_customer_crew_context(p_customer_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_result jsonb;
BEGIN
  IF NOT public.crew_is_staff() AND NOT public.crew_owns_customer(p_customer_id) THEN RAISE EXCEPTION 'No autorizado'; END IF;
  PERFORM public.crew_refresh_membership_statuses();
  SELECT jsonb_build_object(
    'active', m.id IS NOT NULL,
    'membership_id', m.id,
    'member_number', m.member_number,
    'plan_id', m.plan_id,
    'plan_name', m.plan_name_snapshot,
    'started_at', m.started_at,
    'expires_at', m.expires_at,
    'benefits', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', b.id, 'code', b.code, 'name', b.name, 'description', b.description, 'benefit_type', b.benefit_type, 'rule', b.rule) ORDER BY pb.priority DESC, b.name)
      FROM public.crew_plan_benefits pb JOIN public.crew_benefit_definitions b ON b.id = pb.benefit_id
      WHERE pb.plan_id = m.plan_id AND pb.is_active AND b.is_active AND (pb.valid_from IS NULL OR pb.valid_from <= now()) AND (pb.valid_until IS NULL OR pb.valid_until > now())
    ), '[]'::jsonb)
  ) INTO v_result
  FROM (SELECT 1) seed LEFT JOIN LATERAL (
    SELECT * FROM public.crew_memberships WHERE customer_id = p_customer_id AND status = 'active' AND started_at <= now() AND expires_at > now() ORDER BY expires_at DESC LIMIT 1
  ) m ON true;
  RETURN v_result;
END
$$;

CREATE FUNCTION public.crew_calculate_sale_quote(p_customer_id uuid, p_items jsonb, p_manual_discount numeric DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_catalog_subtotal numeric := 0; v_requested_subtotal numeric := 0; v_promo_saving numeric := 0; v_manual_saving numeric := 0; v_crew_saving numeric := 0;
  v_item jsonb; v_variant uuid; v_qty integer; v_requested_price numeric; v_product public.products%ROWTYPE; v_membership public.crew_memberships%ROWTYPE;
  v_benefit public.crew_benefit_definitions%ROWTYPE; v_candidate public.crew_benefit_definitions%ROWTYPE; v_candidate_amount numeric; v_best_amount numeric := 0;
  v_source text := 'none'; v_effective_items jsonb; v_sale_discount numeric := 0; v_snapshot jsonb := NULL;
  v_has_membership boolean := false; v_is_staff boolean := false; v_eligible_subtotal numeric := 0; v_rule_value numeric := 0;
BEGIN
  v_is_staff := public.crew_is_staff();
  IF NOT v_is_staff AND (p_customer_id IS NULL OR NOT public.crew_owns_customer(p_customer_id)) THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'La venta requiere ítems'; END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_variant := (v_item->>'variantId')::uuid; v_qty := (v_item->>'quantity')::integer; v_requested_price := (v_item->>'unitPrice')::numeric;
    SELECT p.* INTO v_product FROM public.product_variants pv JOIN public.products p ON p.id = pv.product_id WHERE pv.id = v_variant;
    IF NOT FOUND OR v_qty <= 0 OR v_requested_price <= 0 THEN RAISE EXCEPTION 'Ítem inválido'; END IF;
    IF abs(v_requested_price - v_product.price) > 0.01 AND NOT EXISTS (SELECT 1 FROM public.products_with_active_discount d WHERE d.product_id = v_product.id AND abs(d.discounted_price - v_requested_price) <= 0.01) THEN RAISE EXCEPTION 'Precio no autorizado'; END IF;
    v_catalog_subtotal := v_catalog_subtotal + v_product.price * v_qty;
    v_requested_subtotal := v_requested_subtotal + v_requested_price * v_qty;
  END LOOP;
  v_promo_saving := GREATEST(0, v_catalog_subtotal - v_requested_subtotal);
  v_manual_saving := CASE WHEN v_is_staff THEN LEAST(GREATEST(COALESCE(p_manual_discount, 0), 0), v_catalog_subtotal) ELSE 0 END;
  PERFORM public.crew_refresh_membership_statuses();
  IF p_customer_id IS NOT NULL THEN
    SELECT * INTO v_membership FROM public.crew_memberships WHERE customer_id = p_customer_id AND status = 'active' AND started_at <= now() AND expires_at > now() ORDER BY expires_at DESC LIMIT 1;
    v_has_membership := FOUND;
  END IF;
  IF v_has_membership THEN
    FOR v_candidate IN
      SELECT b.* FROM public.crew_plan_benefits pb JOIN public.crew_benefit_definitions b ON b.id = pb.benefit_id
      WHERE pb.plan_id = v_membership.plan_id AND pb.is_active AND b.is_active AND (pb.valid_from IS NULL OR pb.valid_from <= now()) AND (pb.valid_until IS NULL OR pb.valid_until > now())
      ORDER BY pb.priority DESC
    LOOP
      v_rule_value := CASE WHEN COALESCE(v_candidate.rule->>'value', '') ~ '^\d+(\.\d+)?$' THEN (v_candidate.rule->>'value')::numeric ELSE 0 END;
      v_eligible_subtotal := v_catalog_subtotal;
      IF v_candidate.benefit_type IN ('product_discount', 'category_discount', 'drop_discount') THEN
        SELECT COALESCE(sum(p.price * (item->>'quantity')::integer), 0) INTO v_eligible_subtotal
        FROM jsonb_array_elements(p_items) item
        JOIN public.product_variants pv ON pv.id = (item->>'variantId')::uuid
        JOIN public.products p ON p.id = pv.product_id
        WHERE (v_candidate.benefit_type = 'product_discount' AND COALESCE(v_candidate.rule->'product_ids', '[]'::jsonb) ? p.id::text)
           OR (v_candidate.benefit_type = 'category_discount' AND COALESCE(v_candidate.rule->'categories', '[]'::jsonb) ? p.category)
           OR (v_candidate.benefit_type = 'drop_discount' AND p.drop_id IS NOT NULL AND COALESCE(v_candidate.rule->'drop_ids', '[]'::jsonb) ? p.drop_id::text);
      END IF;
      v_candidate_amount := CASE v_candidate.benefit_type
        WHEN 'percentage_discount' THEN round(v_eligible_subtotal * LEAST(GREATEST(v_rule_value, 0), 100) / 100, 2)
        WHEN 'fixed_discount' THEN LEAST(v_eligible_subtotal, GREATEST(v_rule_value, 0))
        WHEN 'product_discount' THEN round(v_eligible_subtotal * LEAST(GREATEST(v_rule_value, 0), 100) / 100, 2)
        WHEN 'category_discount' THEN round(v_eligible_subtotal * LEAST(GREATEST(v_rule_value, 0), 100) / 100, 2)
        WHEN 'drop_discount' THEN round(v_eligible_subtotal * LEAST(GREATEST(v_rule_value, 0), 100) / 100, 2)
        ELSE 0 END;
      IF v_candidate.rule ? 'max_discount' THEN v_candidate_amount := LEAST(v_candidate_amount, (v_candidate.rule->>'max_discount')::numeric); END IF;
      IF v_candidate_amount > v_best_amount THEN v_best_amount := v_candidate_amount; v_benefit := v_candidate; END IF;
    END LOOP;
    v_crew_saving := v_best_amount;
  END IF;
  IF v_crew_saving > 0 AND v_crew_saving >= v_manual_saving AND v_crew_saving >= v_promo_saving THEN
    v_source := 'crew'; v_sale_discount := v_crew_saving;
    v_snapshot := jsonb_build_object('benefit_id', v_benefit.id, 'code', v_benefit.code, 'name', v_benefit.name, 'type', v_benefit.benefit_type, 'rule', v_benefit.rule, 'membership_id', v_membership.id, 'plan_code', v_membership.plan_code_snapshot);
  ELSIF v_manual_saving > 0 AND v_manual_saving >= v_promo_saving THEN
    v_source := 'manual'; v_sale_discount := v_manual_saving; v_snapshot := jsonb_build_object('name', 'Descuento manual', 'type', 'fixed_discount', 'amount', v_manual_saving);
  ELSIF v_promo_saving > 0 THEN
    v_source := 'catalog_promotion'; v_snapshot := jsonb_build_object('name', 'Promoción de catálogo', 'type', 'catalog_promotion', 'amount', v_promo_saving);
  END IF;
  IF v_source IN ('crew','manual') THEN
    SELECT jsonb_agg(jsonb_set(item, '{unitPrice}', to_jsonb(p.price), true)) INTO v_effective_items
    FROM jsonb_array_elements(p_items) item JOIN public.product_variants pv ON pv.id = (item->>'variantId')::uuid JOIN public.products p ON p.id = pv.product_id;
  ELSE v_effective_items := p_items; END IF;
  RETURN jsonb_build_object('source', v_source, 'catalog_subtotal', v_catalog_subtotal, 'subtotal', CASE WHEN v_source IN ('crew','manual') THEN v_catalog_subtotal ELSE v_requested_subtotal END, 'discount_amount', v_sale_discount, 'total', CASE WHEN v_source IN ('crew','manual') THEN v_catalog_subtotal - v_sale_discount ELSE v_requested_subtotal END, 'effective_items', v_effective_items, 'membership_id', v_membership.id, 'benefit_id', v_benefit.id, 'benefit_snapshot', v_snapshot, 'savings', GREATEST(v_promo_saving, v_manual_saving, v_crew_saving));
END
$$;

CREATE FUNCTION public.create_sale_atomic_v3(
  p_branch_id uuid, p_user_id uuid, p_items jsonb, p_payment_type text,
  p_discount_amount numeric DEFAULT 0, p_payment_details jsonb DEFAULT NULL,
  p_notes text DEFAULT NULL, p_sale_channel text DEFAULT 'TIENDA',
  p_customer_id uuid DEFAULT NULL, p_client_request_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_quote jsonb; v_sale jsonb; v_sale_id uuid; v_existing jsonb;
BEGIN
  PERFORM public.crm_assert_staff();
  IF p_client_request_id IS NOT NULL THEN
    SELECT jsonb_build_object('id', id, 'user_id', user_id, 'branch_id', branch_id, 'customer_id', customer_id, 'subtotal', subtotal, 'discount_amount', discount_amount, 'total', total, 'sale_date', sale_date, 'payment_type', payment_type, 'payment_details', payment_details, 'notes', notes, 'sale_channel', sale_channel, 'created_at', created_at) INTO v_existing FROM public.sales WHERE client_request_id = p_client_request_id;
    IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
  END IF;
  v_quote := public.crew_calculate_sale_quote(p_customer_id, p_items, p_discount_amount);
  v_sale := public.create_sale_atomic_v2(p_branch_id, p_user_id, v_quote->'effective_items', p_payment_type, (v_quote->>'discount_amount')::numeric, p_payment_details, p_notes, p_sale_channel, p_customer_id, p_client_request_id);
  v_sale_id := (v_sale->>'id')::uuid;
  IF v_quote->>'source' IN ('crew','manual','catalog_promotion') AND p_customer_id IS NOT NULL THEN
    INSERT INTO public.sale_benefit_redemptions(sale_id, customer_id, membership_id, benefit_id, source, benefit_snapshot, discount_amount)
    VALUES (v_sale_id, p_customer_id, nullif(v_quote->>'membership_id','')::uuid, nullif(v_quote->>'benefit_id','')::uuid, v_quote->>'source', COALESCE(v_quote->'benefit_snapshot','{}'::jsonb), (v_quote->>'savings')::numeric)
    ON CONFLICT (sale_id) DO NOTHING;
  END IF;
  RETURN v_sale || jsonb_build_object('benefit', v_quote->'benefit_snapshot', 'discount_source', v_quote->>'source');
END
$$;

CREATE FUNCTION public.crew_admin_dashboard() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.crew_is_admin() THEN RAISE EXCEPTION 'No autorizado'; END IF;
  PERFORM public.crew_refresh_membership_statuses();
  RETURN jsonb_build_object(
    'active_members', (SELECT count(*) FROM public.crew_memberships WHERE status = 'active'),
    'pending_requests', (SELECT count(*) FROM public.crew_membership_requests WHERE status = 'pending'),
    'expiring_30_days', (SELECT count(*) FROM public.crew_memberships WHERE status = 'active' AND expires_at <= now() + interval '30 days'),
    'confirmed_revenue', (SELECT COALESCE(sum(price_snapshot),0) FROM public.crew_membership_requests WHERE status = 'approved')
  );
END
$$;

REVOKE ALL ON FUNCTION public.generate_crew_request_number(), public.generate_crew_member_number(), public.crew_set_updated_at(), public.crew_is_admin(), public.crew_is_staff(), public.crew_owns_customer(uuid), public.crew_refresh_membership_statuses(), public.crew_calculate_sale_quote(uuid,jsonb,numeric), public.create_sale_atomic_v3(uuid,uuid,jsonb,text,numeric,jsonb,text,text,uuid,uuid), public.create_crew_membership_request(uuid), public.submit_crew_receipt(uuid,text), public.approve_crew_request(uuid), public.reject_crew_request(uuid,text), public.get_customer_crew_context(uuid), public.crew_admin_dashboard() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_crew_membership_request(uuid), public.submit_crew_receipt(uuid,text), public.get_customer_crew_context(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_crew_request(uuid), public.reject_crew_request(uuid,text), public.crew_admin_dashboard(), public.crew_calculate_sale_quote(uuid,jsonb,numeric), public.create_sale_atomic_v3(uuid,uuid,jsonb,text,numeric,jsonb,text,text,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_crew_membership_request(uuid), public.submit_crew_receipt(uuid,text), public.approve_crew_request(uuid), public.reject_crew_request(uuid,text), public.get_customer_crew_context(uuid), public.crew_admin_dashboard(), public.crew_calculate_sale_quote(uuid,jsonb,numeric), public.create_sale_atomic_v3(uuid,uuid,jsonb,text,numeric,jsonb,text,text,uuid,uuid) TO service_role;

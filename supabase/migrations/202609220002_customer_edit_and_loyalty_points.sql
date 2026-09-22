-- PASS Clothing — edición de clientes y fidelidad configurable.
-- Aditiva: no modifica migraciones anteriores ni borra historial.
-- La fidelidad queda desactivada hasta que PASS defina su regla comercial.

CREATE TABLE IF NOT EXISTS public.customer_profile_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customer_profiles(id) ON DELETE RESTRICT,
  changed_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  changed_fields text[] NOT NULL DEFAULT '{}',
  before_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  after_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_profile_audit_customer_created
  ON public.customer_profile_audit_log(customer_id, created_at DESC);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.customer_profiles
    WHERE phone_normalized IS NOT NULL
    GROUP BY phone_normalized HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'No se puede crear unicidad de teléfono: existen clientes duplicados por teléfono normalizado';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_profiles_phone_normalized_unique
  ON public.customer_profiles(phone_normalized)
  WHERE phone_normalized IS NOT NULL;

ALTER TABLE public.customer_profile_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS customer_profile_audit_admin_read ON public.customer_profile_audit_log;
CREATE POLICY customer_profile_audit_admin_read ON public.customer_profile_audit_log
  FOR SELECT TO authenticated USING (public.crm_is_admin());

CREATE OR REPLACE FUNCTION public.update_customer_profile(
  p_customer_id uuid,
  p_first_name text,
  p_last_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_instagram text DEFAULT NULL,
  p_active boolean DEFAULT true
) RETURNS public.customer_profiles
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_old public.customer_profiles%ROWTYPE;
  v_new public.customer_profiles%ROWTYPE;
  v_phone text := NULLIF(trim(p_phone), '');
  v_email text := NULLIF(lower(trim(p_email)), '');
  v_first text := NULLIF(trim(p_first_name), '');
  v_last text := NULLIF(trim(p_last_name), '');
  v_fields text[];
BEGIN
  IF NOT public.crm_is_admin() THEN RAISE EXCEPTION 'No autorizado'; END IF;
  SELECT * INTO v_old FROM public.customer_profiles WHERE id = p_customer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cliente no encontrado'; END IF;
  IF v_old.auth_user_id IS NOT NULL AND v_email IS DISTINCT FROM lower(NULLIF(trim(v_old.email), '')) THEN
    RAISE EXCEPTION 'No se puede cambiar silenciosamente el email de un cliente vinculado a Auth';
  END IF;
  IF public.normalize_customer_phone(v_phone) IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.customer_profiles
    WHERE phone_normalized = public.normalize_customer_phone(v_phone) AND id <> p_customer_id
  ) THEN
    RAISE EXCEPTION 'Ya existe otro cliente con ese teléfono';
  END IF;

  UPDATE public.customer_profiles
  SET first_name = v_first,
      last_name = v_last,
      full_name = NULLIF(concat_ws(' ', v_first, v_last), ''),
      phone = v_phone,
      email = v_email,
      instagram = NULLIF(trim(p_instagram), ''),
      deactivated_at = CASE WHEN COALESCE(p_active, true) THEN NULL ELSE COALESCE(deactivated_at, now()) END
  WHERE id = p_customer_id
  RETURNING * INTO v_new;

  SELECT ARRAY(
    SELECT key FROM jsonb_each(to_jsonb(v_old)) old_value
    WHERE to_jsonb(v_new) -> key IS DISTINCT FROM old_value.value
  ) INTO v_fields;
  IF COALESCE(array_length(v_fields, 1), 0) > 0 THEN
    INSERT INTO public.customer_profile_audit_log(customer_id, changed_by, changed_fields, before_snapshot, after_snapshot)
    VALUES (p_customer_id, auth.uid(), v_fields, to_jsonb(v_old), to_jsonb(v_new));
  END IF;
  RETURN v_new;
EXCEPTION
  WHEN unique_violation THEN RAISE EXCEPTION 'El teléfono ya está registrado para otro cliente';
END;
$$;

CREATE TABLE IF NOT EXISTS public.loyalty_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  enabled boolean NOT NULL DEFAULT false,
  points_per_currency_unit numeric(12,4) NOT NULL DEFAULT 0 CHECK (points_per_currency_unit >= 0),
  currency_unit_amount numeric(12,2) NOT NULL DEFAULT 1 CHECK (currency_unit_amount > 0),
  minimum_purchase_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (minimum_purchase_amount >= 0),
  max_points_per_sale integer NULL CHECK (max_points_per_sale IS NULL OR max_points_per_sale >= 0),
  expiration_enabled boolean NOT NULL DEFAULT false,
  expiration_days integer NULL CHECK (expiration_days IS NULL OR expiration_days > 0),
  redemption_enabled boolean NOT NULL DEFAULT false,
  redemption_value numeric(12,4) NOT NULL DEFAULT 0 CHECK (redemption_value >= 0),
  min_points_to_redeem integer NOT NULL DEFAULT 0 CHECK (min_points_to_redeem >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL
);

INSERT INTO public.loyalty_settings(id) VALUES (true) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.customer_loyalty_accounts (
  customer_id uuid PRIMARY KEY REFERENCES public.customer_profiles(id) ON DELETE RESTRICT,
  points_balance integer NOT NULL DEFAULT 0 CHECK (points_balance >= 0),
  lifetime_points_earned integer NOT NULL DEFAULT 0 CHECK (lifetime_points_earned >= 0),
  lifetime_points_redeemed integer NOT NULL DEFAULT 0 CHECK (lifetime_points_redeemed >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_loyalty_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customer_profiles(id) ON DELETE RESTRICT,
  sale_id uuid NULL REFERENCES public.sales(id) ON DELETE RESTRICT,
  type text NOT NULL CHECK (type IN ('earn_purchase', 'redeem', 'adjustment_add', 'adjustment_subtract', 'expiration', 'bonus')),
  points integer NOT NULL CHECK (points <> 0),
  balance_after integer NOT NULL CHECK (balance_after >= 0),
  reason text NOT NULL,
  created_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_loyalty_purchase_once
  ON public.customer_loyalty_transactions(sale_id)
  WHERE sale_id IS NOT NULL AND type = 'earn_purchase';
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_customer_created
  ON public.customer_loyalty_transactions(customer_id, created_at DESC);

ALTER TABLE public.loyalty_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_loyalty_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_loyalty_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS loyalty_settings_admin_read ON public.loyalty_settings;
DROP POLICY IF EXISTS loyalty_accounts_owner_or_staff_read ON public.customer_loyalty_accounts;
DROP POLICY IF EXISTS loyalty_transactions_owner_or_staff_read ON public.customer_loyalty_transactions;
CREATE POLICY loyalty_settings_admin_read ON public.loyalty_settings FOR SELECT TO authenticated USING (public.crm_is_admin());
CREATE POLICY loyalty_accounts_owner_or_staff_read ON public.customer_loyalty_accounts FOR SELECT TO authenticated
  USING (public.crm_is_admin() OR public.crew_is_staff() OR EXISTS (SELECT 1 FROM public.customer_profiles c WHERE c.id = customer_id AND c.auth_user_id = auth.uid()));
CREATE POLICY loyalty_transactions_owner_or_staff_read ON public.customer_loyalty_transactions FOR SELECT TO authenticated
  USING (public.crm_is_admin() OR public.crew_is_staff() OR EXISTS (SELECT 1 FROM public.customer_profiles c WHERE c.id = customer_id AND c.auth_user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.get_customer_loyalty_summary(p_customer_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_account public.customer_loyalty_accounts%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticación requerida'; END IF;
  IF NOT (public.crm_is_admin() OR public.crew_is_staff() OR EXISTS (SELECT 1 FROM public.customer_profiles c WHERE c.id = p_customer_id AND c.auth_user_id = auth.uid())) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  SELECT * INTO v_account FROM public.customer_loyalty_accounts WHERE customer_id = p_customer_id;
  RETURN jsonb_build_object(
    'customer_id', p_customer_id,
    'enabled', (SELECT enabled FROM public.loyalty_settings WHERE id = true),
    'points_balance', COALESCE(v_account.points_balance, 0),
    'lifetime_points_earned', COALESCE(v_account.lifetime_points_earned, 0),
    'lifetime_points_redeemed', COALESCE(v_account.lifetime_points_redeemed, 0),
    'transactions', COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC) FROM (SELECT * FROM public.customer_loyalty_transactions WHERE customer_id = p_customer_id ORDER BY created_at DESC LIMIT 50) t), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_loyalty_settings(
  p_enabled boolean, p_points_per_currency_unit numeric, p_currency_unit_amount numeric,
  p_minimum_purchase_amount numeric, p_max_points_per_sale integer,
  p_expiration_enabled boolean, p_expiration_days integer,
  p_redemption_enabled boolean, p_redemption_value numeric, p_min_points_to_redeem integer
) RETURNS public.loyalty_settings LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_settings public.loyalty_settings%ROWTYPE;
BEGIN
  IF NOT public.crm_is_admin() THEN RAISE EXCEPTION 'No autorizado'; END IF;
  UPDATE public.loyalty_settings SET enabled = COALESCE(p_enabled, false), points_per_currency_unit = GREATEST(COALESCE(p_points_per_currency_unit, 0), 0), currency_unit_amount = GREATEST(COALESCE(p_currency_unit_amount, 1), .01), minimum_purchase_amount = GREATEST(COALESCE(p_minimum_purchase_amount, 0), 0), max_points_per_sale = p_max_points_per_sale, expiration_enabled = COALESCE(p_expiration_enabled, false), expiration_days = p_expiration_days, redemption_enabled = COALESCE(p_redemption_enabled, false), redemption_value = GREATEST(COALESCE(p_redemption_value, 0), 0), min_points_to_redeem = GREATEST(COALESCE(p_min_points_to_redeem, 0), 0), updated_at = now(), updated_by = auth.uid() WHERE id = true RETURNING * INTO v_settings;
  RETURN v_settings;
END;
$$;

CREATE OR REPLACE FUNCTION public.adjust_customer_loyalty_points(p_customer_id uuid, p_points integer, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_account public.customer_loyalty_accounts%ROWTYPE; v_balance integer; v_type text;
BEGIN
  IF NOT public.crm_is_admin() THEN RAISE EXCEPTION 'Solo un administrador puede ajustar puntos'; END IF;
  IF COALESCE(p_points, 0) = 0 OR NULLIF(trim(p_reason), '') IS NULL THEN RAISE EXCEPTION 'Puntos y motivo son obligatorios'; END IF;
  INSERT INTO public.customer_loyalty_accounts(customer_id) VALUES (p_customer_id) ON CONFLICT (customer_id) DO NOTHING;
  SELECT * INTO v_account FROM public.customer_loyalty_accounts WHERE customer_id = p_customer_id FOR UPDATE;
  v_balance := v_account.points_balance + p_points;
  IF v_balance < 0 THEN RAISE EXCEPTION 'El ajuste no puede dejar saldo negativo'; END IF;
  v_type := CASE WHEN p_points > 0 THEN 'adjustment_add' ELSE 'adjustment_subtract' END;
  UPDATE public.customer_loyalty_accounts SET points_balance = v_balance, lifetime_points_earned = lifetime_points_earned + GREATEST(p_points, 0), lifetime_points_redeemed = lifetime_points_redeemed + GREATEST(-p_points, 0), updated_at = now() WHERE customer_id = p_customer_id;
  INSERT INTO public.customer_loyalty_transactions(customer_id, type, points, balance_after, reason, created_by) VALUES (p_customer_id, v_type, p_points, v_balance, trim(p_reason), auth.uid());
  RETURN jsonb_build_object('customer_id', p_customer_id, 'points_balance', v_balance);
END;
$$;

CREATE OR REPLACE FUNCTION public.crm_customer_loyalty_transactions(p_customer_id uuid)
RETURNS TABLE(id uuid, sale_id uuid, type text, points integer, balance_after integer, reason text, created_by uuid, created_at timestamptz, metadata jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.crm_is_admin() THEN RAISE EXCEPTION 'No autorizado'; END IF;
  RETURN QUERY SELECT t.id, t.sale_id, t.type, t.points, t.balance_after, t.reason, t.created_by, t.created_at, t.metadata FROM public.customer_loyalty_transactions t WHERE t.customer_id = p_customer_id ORDER BY t.created_at DESC LIMIT 100;
END;
$$;

CREATE OR REPLACE FUNCTION public.loyalty_earn_purchase(p_sale_id uuid, p_customer_id uuid, p_total numeric)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_settings public.loyalty_settings%ROWTYPE; v_account public.customer_loyalty_accounts%ROWTYPE; v_points integer := 0; v_balance integer;
BEGIN
  SELECT * INTO v_settings FROM public.loyalty_settings WHERE id = true;
  IF NOT COALESCE(v_settings.enabled, false) OR p_customer_id IS NULL OR p_total IS NULL THEN RETURN 0; END IF;
  INSERT INTO public.customer_loyalty_accounts(customer_id) VALUES (p_customer_id) ON CONFLICT (customer_id) DO NOTHING;
  SELECT * INTO v_account FROM public.customer_loyalty_accounts WHERE customer_id = p_customer_id FOR UPDATE;
  IF p_total >= v_settings.minimum_purchase_amount AND v_settings.points_per_currency_unit > 0 THEN
    v_points := floor((p_total / v_settings.currency_unit_amount) * v_settings.points_per_currency_unit)::integer;
    IF v_settings.max_points_per_sale IS NOT NULL THEN v_points := LEAST(v_points, v_settings.max_points_per_sale); END IF;
  END IF;
  IF v_points <= 0 THEN RETURN 0; END IF;
  INSERT INTO public.customer_loyalty_transactions(customer_id, sale_id, type, points, balance_after, reason, metadata)
  VALUES (p_customer_id, p_sale_id, 'earn_purchase', v_points, v_account.points_balance + v_points, 'Puntos por compra', jsonb_build_object('total_final_pagado', p_total, 'regla', jsonb_build_object('points_per_currency_unit', v_settings.points_per_currency_unit, 'currency_unit_amount', v_settings.currency_unit_amount)))
  ON CONFLICT (sale_id) WHERE sale_id IS NOT NULL AND type = 'earn_purchase' DO NOTHING;
  IF NOT FOUND THEN RETURN 0; END IF;
  v_balance := v_account.points_balance + v_points;
  UPDATE public.customer_loyalty_accounts SET points_balance = v_balance, lifetime_points_earned = lifetime_points_earned + v_points, updated_at = now() WHERE customer_id = p_customer_id;
  RETURN v_points;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_sale_atomic_v3(
  p_branch_id uuid, p_user_id uuid, p_items jsonb, p_payment_type text,
  p_discount_amount numeric DEFAULT 0, p_payment_details jsonb DEFAULT NULL,
  p_notes text DEFAULT NULL, p_sale_channel text DEFAULT 'TIENDA',
  p_customer_id uuid DEFAULT NULL, p_client_request_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_quote jsonb; v_sale jsonb; v_sale_id uuid; v_existing jsonb; v_points integer := 0;
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
  v_points := public.loyalty_earn_purchase(v_sale_id, p_customer_id, (v_sale->>'total')::numeric);
  RETURN v_sale || jsonb_build_object('benefit', v_quote->'benefit_snapshot', 'discount_source', v_quote->>'source', 'loyalty_points_earned', v_points);
END
$$;

REVOKE ALL ON FUNCTION public.update_customer_profile(uuid,text,text,text,text,text,boolean), public.get_customer_loyalty_summary(uuid), public.update_loyalty_settings(boolean,numeric,numeric,numeric,integer,boolean,integer,boolean,numeric,integer), public.adjust_customer_loyalty_points(uuid,integer,text), public.crm_customer_loyalty_transactions(uuid), public.loyalty_earn_purchase(uuid,uuid,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_customer_profile(uuid,text,text,text,text,text,boolean), public.get_customer_loyalty_summary(uuid), public.crm_customer_loyalty_transactions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_loyalty_settings(boolean,numeric,numeric,numeric,integer,boolean,integer,boolean,numeric,integer), public.adjust_customer_loyalty_points(uuid,integer,text) TO authenticated;
REVOKE ALL ON FUNCTION public.create_sale_atomic_v3(uuid,uuid,jsonb,text,numeric,jsonb,text,text,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_sale_atomic_v3(uuid,uuid,jsonb,text,numeric,jsonb,text,text,uuid,uuid) TO authenticated;

-- PASS Points: campañas configurables, sin campañas activas por defecto.
-- Los puntos siguen perteneciendo al customer_profile, nunca a Crew.

ALTER TABLE public.loyalty_settings
  ADD COLUMN IF NOT EXISTS rounding_strategy text NOT NULL DEFAULT 'floor'
  CHECK (rounding_strategy IN ('floor', 'round', 'ceil'));

CREATE TABLE IF NOT EXISTS public.loyalty_point_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NULL,
  multiplier numeric(8,3) NOT NULL CHECK (multiplier > 0),
  audience text NOT NULL DEFAULT 'all_customers' CHECK (audience IN ('all_customers', 'crew_only')),
  crew_plan_id uuid NULL REFERENCES public.crew_plans(id) ON DELETE RESTRICT,
  starts_at timestamptz NULL,
  ends_at timestamptz NULL,
  days_of_week smallint[] NULL,
  branch_id uuid NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  sale_channel text NULL CHECK (sale_channel IS NULL OR sale_channel IN ('TIENDA', 'WEB')),
  category text NULL,
  product_id uuid NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  drop_id uuid NULL REFERENCES public.drops(id) ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT false,
  priority integer NOT NULL DEFAULT 0,
  created_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at),
  CHECK (days_of_week IS NULL OR days_of_week <@ ARRAY[0,1,2,3,4,5,6]::smallint[])
);

CREATE INDEX IF NOT EXISTS idx_loyalty_campaigns_active_dates
  ON public.loyalty_point_campaigns(is_active, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_loyalty_campaigns_targeting
  ON public.loyalty_point_campaigns(branch_id, sale_channel, audience);

ALTER TABLE public.loyalty_point_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS loyalty_campaigns_admin_manage ON public.loyalty_point_campaigns;
DROP POLICY IF EXISTS loyalty_campaigns_staff_read ON public.loyalty_point_campaigns;
CREATE POLICY loyalty_campaigns_admin_manage ON public.loyalty_point_campaigns
  FOR ALL TO authenticated USING (public.crm_is_admin()) WITH CHECK (public.crm_is_admin());
CREATE POLICY loyalty_campaigns_staff_read ON public.loyalty_point_campaigns
  FOR SELECT TO authenticated USING (public.crew_is_staff());

CREATE OR REPLACE FUNCTION public.update_loyalty_settings_v2(
  p_enabled boolean, p_points_per_currency_unit numeric, p_currency_unit_amount numeric,
  p_minimum_purchase_amount numeric, p_max_points_per_sale integer,
  p_rounding_strategy text, p_redemption_enabled boolean, p_redemption_value numeric,
  p_min_points_to_redeem integer
) RETURNS public.loyalty_settings
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_settings public.loyalty_settings%ROWTYPE;
BEGIN
  IF NOT public.crm_is_admin() THEN RAISE EXCEPTION 'No autorizado'; END IF;
  UPDATE public.loyalty_settings SET
    enabled = COALESCE(p_enabled, false),
    points_per_currency_unit = GREATEST(COALESCE(p_points_per_currency_unit, 0), 0),
    currency_unit_amount = GREATEST(COALESCE(p_currency_unit_amount, 1), .01),
    minimum_purchase_amount = GREATEST(COALESCE(p_minimum_purchase_amount, 0), 0),
    max_points_per_sale = p_max_points_per_sale,
    rounding_strategy = CASE WHEN p_rounding_strategy IN ('floor','round','ceil') THEN p_rounding_strategy ELSE 'floor' END,
    redemption_enabled = COALESCE(p_redemption_enabled, false),
    redemption_value = GREATEST(COALESCE(p_redemption_value, 0), 0),
    min_points_to_redeem = GREATEST(COALESCE(p_min_points_to_redeem, 0), 0),
    updated_at = now(), updated_by = auth.uid()
  WHERE id = true RETURNING * INTO v_settings;
  RETURN v_settings;
END;
$$;

CREATE OR REPLACE FUNCTION public.loyalty_campaign_multiplier(
  p_customer_id uuid, p_sale_id uuid, p_branch_id uuid, p_sale_channel text, p_at timestamptz DEFAULT now()
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'campaign_id', c.id, 'campaign_name', c.name, 'multiplier', c.multiplier,
    'audience', c.audience, 'priority', c.priority,
    'configuration_snapshot', to_jsonb(c)
  ) INTO v_result
  FROM public.loyalty_point_campaigns c
  WHERE c.is_active
    AND (c.starts_at IS NULL OR p_at >= c.starts_at)
    AND (c.ends_at IS NULL OR p_at <= c.ends_at)
    AND (c.branch_id IS NULL OR c.branch_id = p_branch_id)
    AND (c.sale_channel IS NULL OR c.sale_channel = p_sale_channel)
    AND (c.days_of_week IS NULL OR extract(dow FROM p_at)::smallint = ANY(c.days_of_week))
    AND (c.audience = 'all_customers' OR (
      c.audience = 'crew_only' AND EXISTS (
        SELECT 1 FROM public.crew_memberships m
        WHERE m.customer_id = p_customer_id AND m.status = 'active'
          AND m.expires_at > p_at AND (c.crew_plan_id IS NULL OR c.crew_plan_id = m.plan_id)
      )
    ))
    AND (p_sale_id IS NULL OR (
      c.category IS NULL AND c.product_id IS NULL AND c.drop_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.sale_items si
        JOIN public.product_variants pv ON pv.id = si.variant_id
        JOIN public.products p ON p.id = pv.product_id
        WHERE si.sale_id = p_sale_id
          AND (c.category IS NULL OR p.category = c.category)
          AND (c.product_id IS NULL OR p.id = c.product_id)
          AND (c.drop_id IS NULL OR p.drop_id = c.drop_id)
      )
    ))
  ORDER BY c.multiplier DESC, c.priority DESC, c.created_at DESC
  LIMIT 1;
  RETURN COALESCE(v_result, jsonb_build_object('multiplier', 1, 'audience', 'base'));
END;
$$;

CREATE OR REPLACE FUNCTION public.loyalty_calculate_sale_points(
  p_customer_id uuid, p_total numeric, p_branch_id uuid, p_sale_channel text, p_sale_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_settings public.loyalty_settings%ROWTYPE; v_campaign jsonb; v_base numeric := 0; v_points integer := 0; v_multiplier numeric := 1;
BEGIN
  SELECT * INTO v_settings FROM public.loyalty_settings WHERE id = true;
  IF NOT COALESCE(v_settings.enabled, false) OR p_customer_id IS NULL OR p_total IS NULL OR p_total < v_settings.minimum_purchase_amount THEN
    RETURN jsonb_build_object('base_points', 0, 'multiplier', 1, 'final_points', 0, 'total_eligible', COALESCE(p_total, 0));
  END IF;
  IF v_settings.points_per_currency_unit <= 0 THEN
    RETURN jsonb_build_object('base_points', 0, 'multiplier', 1, 'final_points', 0, 'total_eligible', p_total);
  END IF;
  v_base := (p_total / v_settings.currency_unit_amount) * v_settings.points_per_currency_unit;
  v_base := CASE v_settings.rounding_strategy WHEN 'round' THEN round(v_base) WHEN 'ceil' THEN ceil(v_base) ELSE floor(v_base) END;
  v_campaign := public.loyalty_campaign_multiplier(p_customer_id, p_sale_id, p_branch_id, p_sale_channel);
  v_multiplier := COALESCE((v_campaign->>'multiplier')::numeric, 1);
  v_points := floor(v_base * v_multiplier)::integer;
  IF v_settings.max_points_per_sale IS NOT NULL THEN v_points := LEAST(v_points, v_settings.max_points_per_sale); END IF;
  RETURN jsonb_build_object('base_points', v_base::integer, 'multiplier', v_multiplier,
    'final_points', GREATEST(v_points, 0), 'total_eligible', p_total, 'campaign', v_campaign,
    'configuration_snapshot', jsonb_build_object('loyalty_settings', to_jsonb(v_settings), 'campaign', v_campaign));
END;
$$;

CREATE OR REPLACE FUNCTION public.get_customer_loyalty_campaign(p_customer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN public.loyalty_campaign_multiplier(p_customer_id, NULL, NULL, NULL, now());
END;
$$;

CREATE OR REPLACE FUNCTION public.loyalty_earn_purchase_v2(
  p_sale_id uuid, p_customer_id uuid, p_total numeric, p_branch_id uuid, p_sale_channel text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_account public.customer_loyalty_accounts%ROWTYPE; v_quote jsonb; v_points integer; v_balance integer;
BEGIN
  IF p_customer_id IS NULL OR p_sale_id IS NULL THEN RETURN jsonb_build_object('final_points', 0); END IF;
  IF EXISTS (SELECT 1 FROM public.customer_loyalty_transactions WHERE sale_id = p_sale_id AND type = 'earn_purchase') THEN
    SELECT to_jsonb(t) INTO v_quote FROM public.customer_loyalty_transactions t WHERE t.sale_id = p_sale_id AND t.type = 'earn_purchase' LIMIT 1;
    RETURN jsonb_build_object('final_points', (v_quote->>'points')::integer, 'idempotent', true);
  END IF;
  v_quote := public.loyalty_calculate_sale_points(p_customer_id, p_total, p_branch_id, p_sale_channel, p_sale_id);
  v_points := COALESCE((v_quote->>'final_points')::integer, 0);
  IF v_points <= 0 THEN RETURN v_quote; END IF;
  INSERT INTO public.customer_loyalty_accounts(customer_id) VALUES (p_customer_id) ON CONFLICT (customer_id) DO NOTHING;
  SELECT * INTO v_account FROM public.customer_loyalty_accounts WHERE customer_id = p_customer_id FOR UPDATE;
  v_balance := v_account.points_balance + v_points;
  INSERT INTO public.customer_loyalty_transactions(customer_id, sale_id, type, points, balance_after, reason, metadata)
  VALUES (p_customer_id, p_sale_id, 'earn_purchase', v_points, v_balance, 'Puntos por compra',
    v_quote || jsonb_build_object('sale_id', p_sale_id));
  UPDATE public.customer_loyalty_accounts SET points_balance = v_balance, lifetime_points_earned = lifetime_points_earned + v_points, updated_at = now() WHERE customer_id = p_customer_id;
  RETURN v_quote || jsonb_build_object('balance_after', v_balance);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_sale_atomic_v3(
  p_branch_id uuid, p_user_id uuid, p_items jsonb, p_payment_type text,
  p_discount_amount numeric DEFAULT 0, p_payment_details jsonb DEFAULT NULL,
  p_notes text DEFAULT NULL, p_sale_channel text DEFAULT 'TIENDA',
  p_customer_id uuid DEFAULT NULL, p_client_request_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_quote jsonb; v_sale jsonb; v_sale_id uuid; v_existing jsonb; v_points jsonb;
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
  v_points := public.loyalty_earn_purchase_v2(v_sale_id, p_customer_id, (v_sale->>'total')::numeric, p_branch_id, p_sale_channel);
  RETURN v_sale || jsonb_build_object('benefit', v_quote->'benefit_snapshot', 'discount_source', v_quote->>'source', 'loyalty_points_earned', COALESCE(v_points->>'final_points','0'), 'loyalty_points', v_points);
END;
$$;

REVOKE ALL ON FUNCTION public.update_loyalty_settings_v2(boolean,numeric,numeric,numeric,integer,text,boolean,numeric,integer), public.loyalty_calculate_sale_points(uuid,numeric,uuid,text,uuid), public.loyalty_earn_purchase_v2(uuid,uuid,numeric,uuid,text), public.get_customer_loyalty_campaign(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_loyalty_settings_v2(boolean,numeric,numeric,numeric,integer,text,boolean,numeric,integer), public.loyalty_calculate_sale_points(uuid,numeric,uuid,text,uuid), public.loyalty_earn_purchase_v2(uuid,uuid,numeric,uuid,text), public.get_customer_loyalty_campaign(uuid) TO authenticated;

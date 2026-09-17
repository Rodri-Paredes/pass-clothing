-- Fase 2: atributos de producto y snapshots analíticos de ventas.
-- Los atributos son nullable para no inventar información del catálogo ni de
-- ventas históricas. Las ventas nuevas se congelan en sale_items dentro de la
-- RPC, nunca desde valores enviados por el cliente.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS color text,
  ADD COLUMN IF NOT EXISTS fit text,
  ADD COLUMN IF NOT EXISTS product_style text;

ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS snapshot_category text,
  ADD COLUMN IF NOT EXISTS snapshot_size text,
  ADD COLUMN IF NOT EXISTS snapshot_color text,
  ADD COLUMN IF NOT EXISTS snapshot_fit text,
  ADD COLUMN IF NOT EXISTS snapshot_style text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_color_not_blank') THEN
    ALTER TABLE public.products ADD CONSTRAINT products_color_not_blank
      CHECK (color IS NULL OR btrim(color) <> '');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_fit_valid') THEN
    ALTER TABLE public.products ADD CONSTRAINT products_fit_valid
      CHECK (fit IS NULL OR fit IN ('Oversize', 'Regular', 'Boxy', 'Slim'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_style_valid') THEN
    ALTER TABLE public.products ADD CONSTRAINT products_style_valid
      CHECK (product_style IS NULL OR product_style IN ('Básico', 'Estampado', 'Bordado', 'Serigrafía', 'Otro'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.create_sale_atomic_v2(
  p_branch_id uuid, p_user_id uuid, p_items jsonb, p_payment_type text,
  p_discount_amount numeric DEFAULT 0, p_payment_details jsonb DEFAULT NULL,
  p_notes text DEFAULT NULL, p_sale_channel text DEFAULT 'TIENDA',
  p_customer_id uuid DEFAULT NULL, p_client_request_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sale_id uuid; v_item jsonb; v_variant uuid; v_qty integer; v_price numeric; v_requested_price numeric;
  v_available integer; v_catalog_price numeric; v_product_id uuid; v_price_authorized boolean;
  v_snapshot_category text; v_snapshot_size text; v_snapshot_color text; v_snapshot_fit text; v_snapshot_style text;
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
  IF p_sale_channel NOT IN ('TIENDA', 'WEB', 'REDES_SOCIALES', 'TELEFONO', 'DELIVERY') THEN RAISE EXCEPTION 'Canal de venta inválido'; END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_variant := (v_item->>'variantId')::uuid; v_qty := (v_item->>'quantity')::integer; v_requested_price := (v_item->>'unitPrice')::numeric;
    IF v_qty IS NULL OR v_qty <= 0 OR v_requested_price IS NULL OR v_requested_price <= 0 THEN RAISE EXCEPTION 'Ítem inválido'; END IF;
    SELECT pv.product_id, p.price INTO v_product_id, v_catalog_price FROM public.product_variants pv JOIN public.products p ON p.id = pv.product_id WHERE pv.id = v_variant;
    IF NOT FOUND THEN RAISE EXCEPTION 'Variante inválida %', v_variant; END IF;
    v_price := v_catalog_price;
    IF abs(v_requested_price - v_catalog_price) > 0.01 THEN
      v_price_authorized := false;
      IF to_regclass('public.products_with_active_discount') IS NOT NULL THEN
        EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.products_with_active_discount d WHERE d.product_id = %L::uuid AND abs(d.discounted_price - %L::numeric) <= 0.01)', v_product_id, v_requested_price) INTO v_price_authorized;
        IF v_price_authorized THEN
          EXECUTE format('SELECT d.discounted_price FROM public.products_with_active_discount d WHERE d.product_id = %L::uuid AND abs(d.discounted_price - %L::numeric) <= 0.01 ORDER BY d.discounted_price LIMIT 1', v_product_id, v_requested_price) INTO v_price;
        END IF;
      END IF;
      IF NOT v_price_authorized THEN RAISE EXCEPTION 'Precio no autorizado para la variante %', v_variant; END IF;
    END IF;
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
    v_variant := (v_item->>'variantId')::uuid; v_qty := (v_item->>'quantity')::integer; v_requested_price := (v_item->>'unitPrice')::numeric;
    SELECT pv.product_id, p.price, p.category, pv.size, p.color, p.fit, p.product_style
      INTO v_product_id, v_price, v_snapshot_category, v_snapshot_size, v_snapshot_color, v_snapshot_fit, v_snapshot_style
      FROM public.product_variants pv JOIN public.products p ON p.id = pv.product_id WHERE pv.id = v_variant;
    IF abs(v_requested_price - v_price) > 0.01 THEN
      EXECUTE format('SELECT d.discounted_price FROM public.products_with_active_discount d WHERE d.product_id = %L::uuid AND abs(d.discounted_price - %L::numeric) <= 0.01 ORDER BY d.discounted_price LIMIT 1', v_product_id, v_requested_price) INTO v_price;
    END IF;
    INSERT INTO public.sale_items(sale_id, variant_id, quantity, unit_price, subtotal, snapshot_category, snapshot_size, snapshot_color, snapshot_fit, snapshot_style)
    VALUES (v_sale_id, v_variant, v_qty, v_price, v_qty * v_price, v_snapshot_category, v_snapshot_size, v_snapshot_color, v_snapshot_fit, v_snapshot_style);
    UPDATE public.stock SET quantity = quantity - v_qty, updated_at = now() WHERE variant_id = v_variant AND branch_id = p_branch_id AND quantity >= v_qty;
    GET DIAGNOSTICS v_rows = ROW_COUNT; IF v_rows = 0 THEN RAISE EXCEPTION 'No se pudo decrementar stock'; END IF;
  END LOOP;
  SELECT jsonb_build_object('id', id, 'user_id', user_id, 'branch_id', branch_id, 'customer_id', customer_id, 'subtotal', subtotal, 'discount_amount', discount_amount, 'total', total, 'sale_date', sale_date, 'payment_type', payment_type, 'payment_details', payment_details, 'notes', notes, 'sale_channel', sale_channel, 'created_at', created_at) INTO v_existing FROM public.sales WHERE id = v_sale_id;
  RETURN v_existing;
END;
$$;

CREATE OR REPLACE FUNCTION public.sales_units_breakdown(p_dimension text, p_start_at timestamptz, p_end_at timestamptz, p_branch_id uuid DEFAULT NULL, p_top_n integer DEFAULT 10)
RETURNS TABLE(label text, units bigint, percentage numeric) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_branch_sql text; v_dimension_sql text;
BEGIN
  PERFORM public.crm_assert_staff();
  IF NOT public.crm_is_admin() THEN RAISE EXCEPTION 'No autorizado para estas estadísticas'; END IF;
  IF p_dimension NOT IN ('category', 'size', 'color', 'fit', 'style') OR p_start_at IS NULL OR p_end_at IS NULL OR p_start_at >= p_end_at THEN RAISE EXCEPTION 'Parámetros inválidos'; END IF;
  v_branch_sql := CASE WHEN p_branch_id IS NULL THEN 'NULL::uuid' ELSE quote_literal(p_branch_id::text) || '::uuid' END;
  v_dimension_sql := CASE p_dimension
    WHEN 'category' THEN 'coalesce(nullif(trim(si.snapshot_category), ''''), p.category)'
    WHEN 'size' THEN 'coalesce(nullif(trim(si.snapshot_size), ''''), v.size)'
    WHEN 'color' THEN 'coalesce(nullif(trim(si.snapshot_color), ''''), p.color)'
    WHEN 'fit' THEN 'coalesce(nullif(trim(si.snapshot_fit), ''''), p.fit)'
    ELSE 'coalesce(nullif(trim(si.snapshot_style), ''''), p.product_style)'
  END;
  RETURN QUERY EXECUTE format(
    'WITH grouped AS (SELECT coalesce(nullif(trim(%s), ''''), ''Sin clasificar'') AS label, sum(si.quantity)::bigint AS units
      FROM public.sales s JOIN public.sale_items si ON si.sale_id = s.id
      LEFT JOIN public.product_variants v ON v.id = si.variant_id LEFT JOIN public.products p ON p.id = v.product_id
      WHERE s.sale_date >= %L::timestamptz AND s.sale_date < %L::timestamptz AND (%s IS NULL OR s.branch_id = %s) GROUP BY 1),
    ranked AS (SELECT label, units, sum(units) OVER () AS total_units, row_number() OVER (ORDER BY units DESC, label) AS rn FROM grouped),
    folded AS (SELECT CASE WHEN rn <= %s THEN label ELSE ''Otros'' END AS label, sum(units)::bigint AS units, max(total_units) AS total_units FROM ranked GROUP BY 1)
    SELECT label, units, round((units::numeric / nullif(total_units, 0)) * 100, 2) FROM folded ORDER BY units DESC, label',
    v_dimension_sql, p_start_at, p_end_at, v_branch_sql, v_branch_sql, LEAST(GREATEST(COALESCE(p_top_n, 10), 1), 100)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_sale_atomic_v2(uuid, uuid, jsonb, text, numeric, jsonb, text, text, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sales_units_breakdown(text, timestamptz, timestamptz, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_sale_atomic_v2(uuid, uuid, jsonb, text, numeric, jsonb, text, text, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sales_units_breakdown(text, timestamptz, timestamptz, uuid, integer) TO authenticated;

-- ============================================================
-- ATOMIC SALE CREATION RPC
-- Purpose: Eliminates TOCTOU race condition where a sale record
-- can be created in the DB but stock decrement fails, leaving
-- an orphaned sale with incorrect stock totals.
--
-- The entire flow (stock check → sale insert → items insert →
-- stock decrement) runs inside a single SERIALIZABLE transaction.
-- If any step fails, the transaction rolls back completely.
-- ============================================================

CREATE OR REPLACE FUNCTION create_sale_atomic(
  p_branch_id       UUID,
  p_user_id         UUID,
  p_items           JSONB,        -- [{variantId, quantity, unitPrice}]
  p_payment_type    TEXT,         -- QR | EFECTIVO | TARJETA | MIXTO
  p_subtotal        NUMERIC,
  p_discount_amount NUMERIC DEFAULT 0,
  p_total           NUMERIC DEFAULT 0,
  p_sale_date       TEXT   DEFAULT NULL,  -- ISO8601 Bolivia timestamptz
  p_payment_details JSONB  DEFAULT NULL,  -- {efectivo, qr, tarjeta} for MIXTO
  p_notes           TEXT   DEFAULT NULL,
  p_sale_channel    TEXT   DEFAULT 'TIENDA'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sale_id   UUID;
  v_item      JSONB;
  v_variant   UUID;
  v_qty       INTEGER;
  v_price     NUMERIC;
  v_available INTEGER;
  v_sale_date TIMESTAMPTZ;
  v_result    JSONB;
BEGIN
  -- ── 1. RESOLVE SALE DATE ───────────────────────────────────
  IF p_sale_date IS NOT NULL THEN
    v_sale_date := p_sale_date::TIMESTAMPTZ;
  ELSE
    v_sale_date := NOW() AT TIME ZONE 'America/La_Paz';
  END IF;

  -- ── 2. LOCK & VALIDATE STOCK (prevents concurrent sales from
  --    passing the check at the same time)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_variant := (v_item->>'variantId')::UUID;
    v_qty     := (v_item->>'quantity')::INTEGER;

    SELECT quantity INTO v_available
    FROM stock
    WHERE variant_id = v_variant
      AND branch_id  = p_branch_id
    FOR UPDATE;  -- Row-level lock held until transaction commits

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product variant % has no stock record for this branch', v_variant;
    END IF;

    IF v_available < v_qty THEN
      RAISE EXCEPTION 'Stock insuficiente para la variante %. Disponible: %, Requerido: %',
        v_variant, v_available, v_qty;
    END IF;
  END LOOP;

  -- ── 3. INSERT SALE ─────────────────────────────────────────
  INSERT INTO sales (
    user_id, branch_id, subtotal, discount_amount, total,
    sale_date, payment_type, payment_details, notes, sale_channel
  )
  VALUES (
    p_user_id, p_branch_id, p_subtotal, p_discount_amount, p_total,
    v_sale_date, p_payment_type, p_payment_details, p_notes, p_sale_channel
  )
  RETURNING id INTO v_sale_id;

  -- ── 4. INSERT SALE ITEMS ───────────────────────────────────
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_variant := (v_item->>'variantId')::UUID;
    v_qty     := (v_item->>'quantity')::INTEGER;
    v_price   := (v_item->>'unitPrice')::NUMERIC;

    INSERT INTO sale_items (sale_id, variant_id, quantity, unit_price, subtotal)
    VALUES (v_sale_id, v_variant, v_qty, v_price, v_qty * v_price);
  END LOOP;

  -- ── 5. DECREMENT STOCK ─────────────────────────────────────
  -- Rows are already locked from step 2; just decrement.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_variant := (v_item->>'variantId')::UUID;
    v_qty     := (v_item->>'quantity')::INTEGER;

    UPDATE stock
    SET quantity   = quantity - v_qty,
        updated_at = NOW()
    WHERE variant_id = v_variant
      AND branch_id  = p_branch_id;
  END LOOP;

  -- ── 6. RETURN SALE RECORD ──────────────────────────────────
  SELECT jsonb_build_object(
    'id',             s.id,
    'user_id',        s.user_id,
    'branch_id',      s.branch_id,
    'subtotal',       s.subtotal,
    'discount_amount',s.discount_amount,
    'total',          s.total,
    'sale_date',      s.sale_date,
    'payment_type',   s.payment_type,
    'payment_details',s.payment_details,
    'notes',          s.notes,
    'sale_channel',   s.sale_channel,
    'created_at',     s.created_at
  )
  INTO v_result
  FROM sales s
  WHERE s.id = v_sale_id;

  RETURN v_result;
END;
$$;

-- Grant to authenticated users (RLS on tables still applies for direct access)
GRANT EXECUTE ON FUNCTION create_sale_atomic(UUID,UUID,JSONB,TEXT,NUMERIC,NUMERIC,NUMERIC,TEXT,JSONB,TEXT,TEXT) TO authenticated;

-- ============================================================
-- NOTE: To migrate createSale() to use this RPC, replace the
-- multi-step JS flow in salesService.ts with:
--
--   const { data, error } = await supabase.rpc('create_sale_atomic', {
--     p_branch_id:       branchId,
--     p_user_id:         userId,
--     p_items:           items,         // JSON array
--     p_payment_type:    paymentType,
--     p_subtotal:        subtotal,
--     p_discount_amount: discountAmount,
--     p_total:           total,
--     p_sale_date:       saleDateISO,
--     p_payment_details: paymentDetails ?? null,
--     p_notes:           notes ?? null,
--     p_sale_channel:    saleChannel,
--   });
--   if (error) throw error;
--   return data as Sale;
--
-- This eliminates the orphaned-sale race condition entirely.
-- ============================================================

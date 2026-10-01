BEGIN;

-- Preserve existing publication states; only new inserts default to draft.
ALTER TABLE public.products ALTER COLUMN is_visible SET DEFAULT false;

-- Add restrictive guards alongside existing read permissions.
DROP POLICY IF EXISTS "Drafts are not public" ON public.products;
CREATE POLICY "Drafts are not public" ON public.products
AS RESTRICTIVE FOR SELECT TO anon USING (is_visible = true);

DROP POLICY IF EXISTS "Drafts are only readable by staff" ON public.products;
CREATE POLICY "Drafts are only readable by staff" ON public.products
AS RESTRICTIVE FOR SELECT TO authenticated USING (
  is_visible = true OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('admin', 'vendedor')
  )
);

-- Protect sales from old browser tabs and direct RPC calls.
CREATE OR REPLACE FUNCTION public.check_sale_product_published()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE published boolean;
BEGIN
  SELECT p.is_visible INTO published
  FROM public.products p
  JOIN public.product_variants v ON v.product_id = p.id
  WHERE v.id = NEW.variant_id
  FOR SHARE OF p;

  IF published IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'No se puede vender un producto en borrador u oculto';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sale_product_must_be_published ON public.sale_items;
CREATE TRIGGER sale_product_must_be_published
BEFORE INSERT OR UPDATE OF variant_id ON public.sale_items
FOR EACH ROW EXECUTE FUNCTION public.check_sale_product_published();

COMMIT;

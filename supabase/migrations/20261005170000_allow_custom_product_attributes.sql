BEGIN;

-- Keep nullable text and reject blanks, but accept custom fits/styles.
-- No product data, permissions or stock are changed.
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_fit_valid,
  DROP CONSTRAINT IF EXISTS products_style_valid;

ALTER TABLE public.products
  ADD CONSTRAINT products_fit_valid CHECK (fit IS NULL OR btrim(fit) <> ''),
  ADD CONSTRAINT products_style_valid CHECK (product_style IS NULL OR btrim(product_style) <> '');

COMMIT;

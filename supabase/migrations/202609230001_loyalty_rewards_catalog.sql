-- PASS Clothing — catálogo público de recompensas.
-- No activa canjes: únicamente publica recompensas configuradas.

CREATE TABLE IF NOT EXISTS public.loyalty_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NULL,
  reward_type text NOT NULL DEFAULT 'manual',
  points_cost integer NOT NULL CHECK (points_cost > 0),
  is_active boolean NOT NULL DEFAULT true,
  is_public boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.loyalty_rewards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS loyalty_rewards_public_read ON public.loyalty_rewards;
CREATE POLICY loyalty_rewards_public_read ON public.loyalty_rewards
  FOR SELECT TO anon, authenticated USING (is_active AND is_public);

INSERT INTO public.loyalty_rewards(code, name, description, reward_type, points_cost, display_order)
VALUES
  ('ENVIO-GRATIS', 'Envío gratis', 'En tu próxima compra, a cualquier ciudad de Bolivia.', 'shipping', 200, 10),
  ('DESCUENTO-10', '10% off adicional', 'Combinable con tu beneficio vigente en un pedido.', 'discount', 400, 20),
  ('GORRA-PASS-CREW', 'Gorra Pass Crew', 'Edición exclusiva, solo disponible vía canje de puntos.', 'product', 1200, 30),
  ('GIFT-CARD-100', 'Tarjeta de regalo Bs 100', 'Para usar en cualquier compra dentro de la tienda.', 'gift_card', 1000, 40),
  ('VIP-DROP', 'Acceso VIP a evento de drop', 'Entrada para ti y un acompañante al próximo evento Crew.', 'experience', 1800, 50),
  ('HOODIE-FOUNDER', 'Hoodie exclusivo Founder', 'Pieza limitada, solo para miembros con 3.500 puntos o más.', 'product', 3500, 60)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  reward_type = EXCLUDED.reward_type,
  points_cost = EXCLUDED.points_cost,
  display_order = EXCLUDED.display_order,
  updated_at = now();

CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_public_order
  ON public.loyalty_rewards(is_active, is_public, display_order);

GRANT SELECT ON public.loyalty_rewards TO anon, authenticated;

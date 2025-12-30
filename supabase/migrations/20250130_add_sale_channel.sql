-- Migración: Agregar canal de venta a las ventas
-- Permite diferenciar entre ventas en tienda, web, redes sociales, etc.

-- 1. AGREGAR COLUMNA sale_channel
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS sale_channel text NOT NULL DEFAULT 'TIENDA'
CHECK (sale_channel IN ('TIENDA', 'WEB'));

-- 2. CREAR ÍNDICE para búsquedas rápidas por canal
CREATE INDEX IF NOT EXISTS idx_sales_sale_channel ON sales(sale_channel);

-- 3. CREAR ÍNDICE compuesto para consultas comunes (sucursal + canal + fecha)
CREATE INDEX IF NOT EXISTS idx_sales_branch_channel_date 
ON sales(branch_id, sale_channel, sale_date DESC);

-- 4. COMENTARIOS
COMMENT ON COLUMN sales.sale_channel IS 
  'Canal por el cual se realizó la venta: TIENDA o WEB';

-- 5. FUNCIÓN PARA OBTENER ESTADÍSTICAS POR CANAL
CREATE OR REPLACE FUNCTION get_sales_by_channel(
  p_branch_id uuid,
  p_start_date timestamptz,
  p_end_date timestamptz
)
RETURNS TABLE (
  sale_channel text,
  total_sales bigint,
  total_revenue decimal(10,2),
  average_sale decimal(10,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.sale_channel,
    COUNT(s.id) as total_sales,
    COALESCE(SUM(s.total), 0)::decimal(10,2) as total_revenue,
    COALESCE(AVG(s.total), 0)::decimal(10,2) as average_sale
  FROM sales s
  WHERE s.branch_id = p_branch_id
    AND s.sale_date >= p_start_date
    AND s.sale_date <= p_end_date
  GROUP BY s.sale_channel
  ORDER BY total_revenue DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. FUNCIÓN PARA OBTENER TOP PRODUCTOS POR CANAL
CREATE OR REPLACE FUNCTION get_top_products_by_channel(
  p_branch_id uuid,
  p_sale_channel text,
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_limit int DEFAULT 10
)
RETURNS TABLE (
  product_name text,
  total_quantity bigint,
  total_revenue decimal(10,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.name as product_name,
    SUM(si.quantity) as total_quantity,
    SUM(si.subtotal)::decimal(10,2) as total_revenue
  FROM sales s
  JOIN sale_items si ON si.sale_id = s.id
  JOIN product_variants pv ON pv.id = si.variant_id
  JOIN products p ON p.id = pv.product_id
  WHERE s.branch_id = p_branch_id
    AND s.sale_channel = p_sale_channel
    AND s.sale_date >= p_start_date
    AND s.sale_date <= p_end_date
  GROUP BY p.id, p.name
  ORDER BY total_revenue DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. COMENTARIOS FINALES
COMMENT ON FUNCTION get_sales_by_channel IS 
  'Obtiene estadísticas de ventas agrupadas por canal en un rango de fechas';

COMMENT ON FUNCTION get_top_products_by_channel IS 
  'Obtiene los productos más vendidos en un canal específico';

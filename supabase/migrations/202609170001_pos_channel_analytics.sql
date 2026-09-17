-- Fase POS/canal: no agrega columnas; sale_channel ya es la fuente histórica.
CREATE OR REPLACE FUNCTION public.sales_channel_breakdown(
  p_start_at timestamptz, p_end_at timestamptz, p_branch_id uuid DEFAULT NULL
)
RETURNS TABLE(channel text, sales_count bigint, units bigint, revenue numeric, sales_percentage numeric, units_percentage numeric, revenue_percentage numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_branch_sql text;
BEGIN
  PERFORM public.crm_assert_staff();
  IF NOT public.crm_is_admin() THEN RAISE EXCEPTION 'No autorizado para estas estadísticas'; END IF;
  IF p_start_at IS NULL OR p_end_at IS NULL OR p_start_at >= p_end_at THEN RAISE EXCEPTION 'Parámetros inválidos'; END IF;
  v_branch_sql := CASE WHEN p_branch_id IS NULL THEN 'NULL::uuid' ELSE quote_literal(p_branch_id::text) || '::uuid' END;
  RETURN QUERY EXECUTE format(
    'WITH per_sale AS (
      SELECT CASE upper(coalesce(nullif(trim(s.sale_channel), ''''), ''OTROS'')) WHEN ''TIENDA'' THEN ''Tienda'' WHEN ''WEB'' THEN ''Web'' ELSE ''Otros'' END AS channel,
             s.id, s.total, coalesce(sum(si.quantity), 0)::bigint AS units
      FROM public.sales s LEFT JOIN public.sale_items si ON si.sale_id = s.id
      WHERE s.sale_date >= %L::timestamptz AND s.sale_date < %L::timestamptz AND (%s IS NULL OR s.branch_id = %s)
      GROUP BY 1, s.id, s.total), grouped AS (
      SELECT channel, count(*)::bigint sales_count, sum(units)::bigint units, sum(total)::numeric revenue FROM per_sale GROUP BY channel), totals AS (
      SELECT *, sum(sales_count) OVER () total_sales, sum(units) OVER () total_units, sum(revenue) OVER () total_revenue FROM grouped)
    SELECT channel, sales_count, units, revenue,
      round(sales_count::numeric / nullif(total_sales, 0) * 100, 2),
      round(units::numeric / nullif(total_units, 0) * 100, 2),
      round(revenue / nullif(total_revenue, 0) * 100, 2)
    FROM totals ORDER BY sales_count DESC, channel', p_start_at, p_end_at, v_branch_sql, v_branch_sql);
END;
$$;
REVOKE ALL ON FUNCTION public.sales_channel_breakdown(timestamptz, timestamptz, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sales_channel_breakdown(timestamptz, timestamptz, uuid) TO authenticated;

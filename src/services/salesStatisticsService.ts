import { supabase } from '../lib/supabase';
import type { SalesUnitsBreakdown } from '../lib/types';

export const salesStatisticsService = {
  async unitsBreakdown(dimension: 'category' | 'size', startAt: string, endAt: string, branchId?: string, topN = 10): Promise<SalesUnitsBreakdown[]> {
    const { data, error } = await supabase.rpc('sales_units_breakdown', {
      p_dimension: dimension, p_start_at: startAt, p_end_at: endAt, p_branch_id: branchId || null, p_top_n: topN,
    });
    if (error) throw error;
    return ((data || []) as Array<{ label: string; units: number | string; percentage: number | string }>).map((row) => ({ label: row.label, units: Number(row.units), percentage: Number(row.percentage) }));
  },
};

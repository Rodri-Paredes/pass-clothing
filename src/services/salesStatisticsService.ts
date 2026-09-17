import { supabase } from '../lib/supabase';
import type { SalesChannelBreakdown, SalesUnitsBreakdown } from '../lib/types';

export const salesStatisticsService = {
  async channelBreakdown(startAt: string, endAt: string, branchId?: string): Promise<SalesChannelBreakdown[]> {
    const { data, error } = await supabase.rpc('sales_channel_breakdown', { p_start_at: startAt, p_end_at: endAt, p_branch_id: branchId || null });
    if (error) throw error;
    return (data || []).map((row: SalesChannelBreakdown) => ({ ...row, sales_count: Number(row.sales_count), units: Number(row.units), revenue: Number(row.revenue), sales_percentage: Number(row.sales_percentage), units_percentage: Number(row.units_percentage), revenue_percentage: Number(row.revenue_percentage) }));
  },
  async unitsBreakdown(dimension: 'category' | 'size' | 'color' | 'fit' | 'style', startAt: string, endAt: string, branchId?: string, topN = 10): Promise<SalesUnitsBreakdown[]> {
    const { data, error } = await supabase.rpc('sales_units_breakdown', {
      p_dimension: dimension, p_start_at: startAt, p_end_at: endAt, p_branch_id: branchId || null, p_top_n: topN,
    });
    if (error) throw error;
    return ((data || []) as Array<{ label: string; units: number | string; percentage: number | string }>).map((row) => ({ label: row.label, units: Number(row.units), percentage: Number(row.percentage) }));
  },
};

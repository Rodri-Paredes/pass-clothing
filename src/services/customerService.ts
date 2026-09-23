import { supabase } from '../lib/supabase';
import type { Customer, LoyaltyPointCampaign, LoyaltySettings, LoyaltySummary } from '../lib/types';

type CustomerRow = Customer & { total_count?: number };

export const customerService = {
  async search(query: string): Promise<Customer[]> {
    const { data, error } = await supabase.rpc('search_customers', { p_query: query, p_limit: 20 });
    if (error) throw error;
    return (data || []) as Customer[];
  },

  async create(input: Pick<Customer, 'first_name' | 'last_name' | 'ci' | 'phone' | 'email' | 'instagram'>): Promise<Customer> {
    const { data, error } = await supabase.rpc('create_customer', {
      p_first_name: input.first_name || null,
      p_last_name: input.last_name || null,
      p_ci: input.ci || null,
      p_phone: input.phone || null,
      p_email: input.email || null,
      p_instagram: input.instagram || null,
    });
    if (error) throw error;
    return data as Customer;
  },

  async list(query: string, page: number, pageSize = 25): Promise<{ customers: Customer[]; total: number }> {
    const { data, error } = await supabase.rpc('crm_list_customers', {
      p_query: query || null, p_page: page, p_page_size: pageSize,
    });
    if (error) throw error;
    const rows = (data || []) as CustomerRow[];
    return { customers: rows, total: Number(rows[0]?.total_count || 0) };
  },

  async detail(customerId: string): Promise<unknown> {
    const { data, error } = await supabase.rpc('crm_customer_detail', { p_customer_id: customerId });
    if (error) throw error;
    return data;
  },

  async update(customerId: string, input: Pick<Customer, 'first_name' | 'last_name' | 'phone' | 'email' | 'instagram'> & { active: boolean }): Promise<Customer> {
    const { data, error } = await supabase.rpc('update_customer_profile', {
      p_customer_id: customerId,
      p_first_name: input.first_name || null,
      p_last_name: input.last_name || null,
      p_phone: input.phone || null,
      p_email: input.email || null,
      p_instagram: input.instagram || null,
      p_active: input.active,
    });
    if (error) throw error;
    return data as Customer;
  },

  async loyalty(customerId: string): Promise<LoyaltySummary> {
    const { data, error } = await supabase.rpc('get_customer_loyalty_summary', { p_customer_id: customerId });
    if (error) throw error;
    return data as LoyaltySummary;
  },

  async loyaltyTransactions(customerId: string) {
    const { data, error } = await supabase.rpc('crm_customer_loyalty_transactions', { p_customer_id: customerId });
    if (error) throw error;
    return data || [];
  },

  async adjustPoints(customerId: string, points: number, reason: string) {
    const { data, error } = await supabase.rpc('adjust_customer_loyalty_points', { p_customer_id: customerId, p_points: points, p_reason: reason });
    if (error) throw error;
    return data as { points_balance: number };
  },

  async loyaltySettings(): Promise<LoyaltySettings> {
    const { data, error } = await supabase.from('loyalty_settings').select('*').eq('id', true).single();
    if (error) throw error;
    return data as LoyaltySettings;
  },

  async updateLoyaltySettings(settings: LoyaltySettings): Promise<LoyaltySettings> {
    const { data, error } = await supabase.rpc('update_loyalty_settings_v2', {
      p_enabled: settings.enabled,
      p_points_per_currency_unit: settings.points_per_currency_unit,
      p_currency_unit_amount: settings.currency_unit_amount,
      p_minimum_purchase_amount: settings.minimum_purchase_amount,
      p_max_points_per_sale: settings.max_points_per_sale,
      p_rounding_strategy: settings.rounding_strategy || 'floor',
      p_redemption_enabled: settings.redemption_enabled,
      p_redemption_value: settings.redemption_value,
      p_min_points_to_redeem: settings.min_points_to_redeem,
    });
    if (error) throw error;
    return data as LoyaltySettings;
  },

  async loyaltyCampaigns(): Promise<LoyaltyPointCampaign[]> {
    const { data, error } = await supabase.from('loyalty_point_campaigns').select('*').order('priority', { ascending: false }).order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as LoyaltyPointCampaign[];
  },

  async createLoyaltyCampaign(input: Partial<LoyaltyPointCampaign>): Promise<LoyaltyPointCampaign> {
    const { data, error } = await supabase.from('loyalty_point_campaigns').insert(input).select().single();
    if (error) throw error;
    return data as LoyaltyPointCampaign;
  },

  async updateLoyaltyCampaign(id: string, input: Partial<LoyaltyPointCampaign>): Promise<LoyaltyPointCampaign> {
    const { data, error } = await supabase.from('loyalty_point_campaigns').update({ ...input, updated_at: new Date().toISOString() }).eq('id', id).select().single();
    if (error) throw error;
    return data as LoyaltyPointCampaign;
  },
};

import { supabase } from '../lib/supabase';
import type { Customer } from '../lib/types';

type CustomerRow = Customer & { total_count?: number };

export const customerService = {
  async search(query: string): Promise<Customer[]> {
    const { data, error } = await supabase.rpc('search_customers', { p_query: query, p_limit: 20 });
    if (error) throw error;
    return (data || []) as Customer[];
  },

  async create(input: Pick<Customer, 'first_name' | 'last_name' | 'phone' | 'email' | 'instagram'>): Promise<Customer> {
    const { data, error } = await supabase.rpc('create_customer', {
      p_first_name: input.first_name || null,
      p_last_name: input.last_name || null,
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
};

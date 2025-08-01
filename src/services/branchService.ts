import { supabase } from '../lib/supabase';
import type { Branch } from '../lib/types';

export class BranchService {
  async getBranches(): Promise<Branch[]> {
    const { data, error } = await supabase
      .from('branches')
      .select('*')
      .order('name');

    if (error) throw error;
    return data || [];
  }

  async getBranch(id: string): Promise<Branch | null> {
    const { data, error } = await supabase
      .from('branches')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }
}

export const branchService = new BranchService();
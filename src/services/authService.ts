import { supabase } from '../lib/supabase';
import type { User } from '../lib/types';

export class AuthService {
  async signUp(email: string, password: string, name: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) throw error;

    if (data.user) {
      // Create user profile
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: data.user.id,
          name,
          email,
          role: 'vendedor'
        });

      if (profileError) throw profileError;
    }

    return data;
  }

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  }

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  async getCurrentUser(): Promise<User | null> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return null;

    const { data: profile, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) throw error;
    return profile;
  }

  async updateUserBranch(userId: string, branchId: string) {
    const { error } = await supabase
      .from('users')
      .update({ branch_id: branchId })
      .eq('id', userId);

    if (error) throw error;
  }
}

export const authService = new AuthService();
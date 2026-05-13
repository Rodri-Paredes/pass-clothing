import { create } from 'zustand';
import type { User, Branch } from '../lib/types';
import { authService } from '../services/authService';
import { branchService } from '../services/branchService';
import { supabase } from '../lib/supabase';

interface AuthState {
  user: User | null;
  activeBranch: Branch | null;
  branches: Branch[];
  isLoading: boolean;
  isAuthenticated: boolean;
  
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  loadUser: () => Promise<void>;
  loadBranches: () => Promise<void>;
  setActiveBranch: (branch: Branch) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  activeBranch: null,
  branches: [],
  isLoading: true,
  isAuthenticated: false,

  signIn: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      await authService.signIn(email, password);
      await get().loadUser();
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  signUp: async (email: string, password: string, name: string) => {
    set({ isLoading: true });
    try {
      await authService.signUp(email, password, name);
      await get().loadUser();
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  signOut: async () => {
    await authService.signOut();
    set({
      user: null,
      activeBranch: null,
      isAuthenticated: false,
      isLoading: false
    });
  },

  loadUser: async () => {
    try {
      const user = await authService.getCurrentUser();
      set({
        user,
        isAuthenticated: !!user,
        isLoading: false
      });
      
      if (user) {
        await get().loadBranches();
      }
    } catch (error) {
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false
      });
    }
  },

  loadBranches: async () => {
    try {
      const branches = await branchService.getBranches();
      set({ branches });
      
      const { user } = get();
      if (user?.branch_id) {
        const userBranch = branches.find(b => b.id === user.branch_id);
        if (userBranch) {
          set({ activeBranch: userBranch });
        }
      }
    } catch (error) {
      console.error('Failed to load branches:', error);
    }
  },

  setActiveBranch: async (branch: Branch) => {
    const { user } = get();
    if (!user) return;

    try {
      await authService.updateUserBranch(user.id, branch.id);
      set({ 
        activeBranch: branch,
        user: { ...user, branch_id: branch.id }
      });
    } catch (error) {
      throw error;
    }
  }
}));

// Listen for auth state changes (token refresh, sign-out from another tab, session expiry)
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') {
    useAuthStore.setState({
      user: null,
      activeBranch: null,
      branches: [],
      isAuthenticated: false,
      isLoading: false,
    });
  }
});
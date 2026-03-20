import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import type { Profile } from '@/types/database';
import { supabase } from '@/lib/supabase';
import { getProfile } from '@/services/profile.service';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  refreshProfile: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  isLoading: true,

  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setLoading: (isLoading) => set({ isLoading }),

  refreshProfile: async () => {
    const { session } = get();
    if (!session?.user) return;
    try {
      const profile = await getProfile(session.user.id);
      set({ profile });
    } catch {}
  },

  reset: () => set({ session: null, profile: null, isLoading: false }),
}));

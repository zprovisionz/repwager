import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import type { Profile } from '@/types/database';
import { supabase } from '@/lib/supabase';
import { getProfile } from '@/services/profile.service';

type AuthStage =
  | 'signed_out'
  | 'needs_email_verification'
  | 'needs_username'
  | 'authenticated';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  authError: string | null;
  authStage: AuthStage;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setAuthError: (message: string | null) => void;
  refreshProfile: () => Promise<void>;
  hydrateAuth: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  isLoading: true,
  authError: null,
  authStage: 'signed_out',

  setSession: (session) => set({ session, authStage: session ? get().authStage : 'signed_out' }),
  setProfile: (profile) =>
    set({
      profile,
      authStage: !get().session
        ? 'signed_out'
        : !get().session?.user?.email_confirmed_at
          ? 'needs_email_verification'
          : profile
            ? 'authenticated'
            : 'needs_username',
    }),
  setLoading: (isLoading) => set({ isLoading }),
  setAuthError: (authError) => set({ authError }),

  refreshProfile: async () => {
    const { session } = get();
    if (!session?.user) {
      set({ profile: null, authStage: 'signed_out' });
      return;
    }
    try {
      const profile = await getProfile(session.user.id);
      set({
        profile,
        authStage: session.user.email_confirmed_at ? 'authenticated' : 'needs_email_verification',
        authError: null,
      });
    } catch {
      set({
        profile: null,
        authStage: session.user.email_confirmed_at ? 'needs_username' : 'needs_email_verification',
      });
    }
  },

  hydrateAuth: async () => {
    set({ isLoading: true });
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      set({ session: null, profile: null, authStage: 'signed_out', authError: error.message, isLoading: false });
      return;
    }
    const session = data.session;
    if (!session?.user) {
      set({ session: null, profile: null, authStage: 'signed_out', authError: null, isLoading: false });
      return;
    }
    set({ session, authError: null });
    await get().refreshProfile();
    set({ isLoading: false });
  },

  reset: () =>
    set({
      session: null,
      profile: null,
      isLoading: false,
      authError: null,
      authStage: 'signed_out',
    }),
}));

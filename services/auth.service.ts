import { supabase } from '@/lib/supabase';

export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: 'repwager://auth/callback',
    },
  });
  if (error) throw error;
  return data;
}

export async function createUsernameProfile(
  userId: string,
  username: string
) {
  const { data, error } = await (supabase.rpc as any)('new_user_profile', {
    p_user_id: userId,
    p_username: username,
    p_avatar_gender: 'male',
  });
  if (error) throw error;
  return data;
}

export async function resendVerification(email: string) {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: {
      emailRedirectTo: 'repwager://auth/callback',
    },
  });
  if (error) throw error;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
  const candidate = username.trim().toLowerCase();
  if (candidate.length < 3) return false;
  const { data, error } = await (supabase.from('profiles') as any)
    .select('id')
    .eq('username', candidate)
    .limit(1);
  if (error) throw error;
  return !data || data.length === 0;
}

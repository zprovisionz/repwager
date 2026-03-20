import { supabase } from '@/lib/supabase';

export async function signUp(email: string, password: string, username: string, displayName: string, avatarGender: 'male' | 'female') {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  if (!data.user) throw new Error('No user returned');

  const { error: profileError } = await (supabase.rpc as any)('new_user_profile', {
    p_user_id: data.user.id,
    p_username: username,
    p_display_name: displayName,
    p_avatar_gender: avatarGender,
  });
  if (profileError) throw profileError;

  return data;
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

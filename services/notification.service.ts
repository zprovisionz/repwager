import { supabase } from '@/lib/supabase';
import type { Notification } from '@/types/database';

export async function getNotifications(userId: string): Promise<Notification[]> {
  const { data, error } = await (supabase.from('notifications') as any)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as Notification[];
}

export async function markAsRead(notificationId: string) {
  const { error } = await (supabase.from('notifications') as any)
    .update({ read: true })
    .eq('id', notificationId);
  if (error) throw error;
}

export async function markAllAsRead(userId: string) {
  const { error } = await (supabase.from('notifications') as any)
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);
  if (error) throw error;
}

export function subscribeToNotifications(userId: string, callback: (notification: Notification) => void) {
  return supabase
    .channel(`notifications:${userId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${userId}`,
    }, (payload) => {
      callback(payload.new as Notification);
    })
    .subscribe();
}

import { supabase } from '@/lib/supabase';

export async function purchaseStreakFreeze(userId: string) {
  const { error } = await (supabase.rpc as any)('purchase_item', { p_user_id: userId, p_item_id: 'freeze_pack_1' });
  if (error) throw error;
}

export async function purchaseCosmetic(userId: string, itemId: string) {
  const { error } = await (supabase.rpc as any)('purchase_item', { p_user_id: userId, p_item_id: itemId });
  if (error) throw error;
}

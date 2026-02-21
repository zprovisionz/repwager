import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

export async function registerPushToken(userId: string): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  try {
    const Device = await import('expo-device');
    const Notifications = await import('expo-notifications');

    if (!Device.default.isDevice) return null;

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return null;

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    await (supabase.from('push_tokens') as any).upsert(
      { user_id: userId, token, platform: Platform.OS, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,token' }
    );

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

    return token;
  } catch {
    return null;
  }
}

export async function unregisterPushToken(userId: string, token: string): Promise<void> {
  await (supabase.from('push_tokens') as any)
    .delete()
    .eq('user_id', userId)
    .eq('token', token);
}

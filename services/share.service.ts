import * as Sharing from 'expo-sharing';
import ViewShot from 'react-native-view-shot';
import type { RefObject } from 'react';

export async function generateShareCard(
  viewShotRef: RefObject<ViewShot>
): Promise<string | null> {
  try {
    if (!viewShotRef.current) return null;
    const uri: string = await (viewShotRef.current as any).capture();
    return uri;
  } catch {
    return null;
  }
}

export async function shareImage(uri: string, message?: string): Promise<void> {
  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Sharing is not available on this device');
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'image/png',
    dialogTitle: message ?? 'Share your RepWager stats',
  });
}

export function buildDeepLink(type: 'challenge' | 'profile' | 'league', id: string): string {
  switch (type) {
    case 'challenge':
      return `repwager://challenge/${id}`;
    case 'profile':
      return `repwager://profile/${id}`;
    case 'league':
      return `repwager://league/${id}`;
    default:
      return 'repwager://';
  }
}

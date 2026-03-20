import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';

export default function OnboardingIndex() {
  const router = useRouter();
  const { profile } = useAuthStore();

  useEffect(() => {
    if (!profile) return;
    if ((profile as any).has_completed_onboarding) {
      router.replace('/(tabs)');
      return;
    }
    router.replace('/onboarding/age-gate');
  }, [profile]);

  return null;
}

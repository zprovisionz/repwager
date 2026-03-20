import { Redirect, Stack } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';

export default function AuthLayout() {
  const { session, profile, isLoading } = useAuthStore();

  if (isLoading) return null;
  if (session && profile) return <Redirect href="/(tabs)" />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#080C14' } }} />
  );
}

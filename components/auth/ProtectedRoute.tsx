import type { ReactNode } from 'react';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { colors } from '@/lib/theme';

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { authStage, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (authStage !== 'authenticated') {
    if (authStage === 'needs_email_verification') return <Redirect href="/(auth)/verify-email" />;
    if (authStage === 'needs_username') return <Redirect href="/(auth)/username-setup" />;
    return <Redirect href="/(auth)" />;
  }

  return <>{children}</>;
}

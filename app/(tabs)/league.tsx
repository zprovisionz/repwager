import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@/lib/theme';

/**
 * League tab — vision: purple hub. Stack lives at `app/leagues/*`.
 */
export default function LeagueTabScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/leagues');
  }, [router]);

  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
});

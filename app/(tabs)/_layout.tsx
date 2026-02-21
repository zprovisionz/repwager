import { Redirect, Tabs } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { colors, typography } from '@/lib/theme';
import { Home, Award, User } from 'lucide-react-native';
import { View, StyleSheet } from 'react-native';

export default function TabsLayout() {
  const { session, profile, isLoading } = useAuthStore();

  if (isLoading) return null;
  if (!session || !profile) return <Redirect href="/(auth)" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: styles.tabLabel,
        tabBarBackground: () => <View style={styles.tabBg} />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="leagues"
        options={{
          title: 'Leagues',
          tabBarIcon: ({ color, size }) => <Award size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: 'transparent',
    borderTopWidth: 1,
    borderTopColor: '#1E2E45',
    height: 60,
    paddingBottom: 6,
  },
  tabBg: {
    flex: 1,
    backgroundColor: '#0D1424',
  },
  tabLabel: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 11,
  },
});

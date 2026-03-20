import { Redirect, Tabs } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { colors, typography } from '@/lib/theme';
import { Home, Film, Trophy, User, Plus } from 'lucide-react-native';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

function CentreCreateButton() {
  const router = useRouter();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  function handlePress() {
    scale.value = withSpring(0.88, { damping: 12 }, () => {
      scale.value = withSpring(1, { damping: 12 });
    });
    router.push('/challenge/create');
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={1}
      style={styles.centreButtonWrapper}
    >
      <Animated.View style={[styles.centreButton, animatedStyle]}>
        <Plus size={26} color={colors.textInverse} strokeWidth={2.5} />
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function TabsLayout() {
  const { session, profile, isLoading } = useAuthStore();
  const insets = useSafeAreaInsets();

  if (isLoading) return null;
  if (!session || !profile) return <Redirect href="/(auth)" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: [
          styles.tabBar,
          { paddingBottom: insets.bottom > 0 ? insets.bottom : 8 },
        ],
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: styles.tabLabel,
        tabBarBackground: () => <View style={styles.tabBg} />,
        tabBarShowLabel: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Home size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="theatre"
        options={{
          title: 'Theatre',
          tabBarIcon: ({ color, size }) => (
            <Film size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="create-placeholder"
        options={{
          title: '',
          tabBarIcon: () => null,
          tabBarLabel: () => null,
          tabBarButton: () => <CentreCreateButton />,
        }}
        listeners={{
          tabPress: (e) => e.preventDefault(),
        }}
      />

      <Tabs.Screen
        name="leaderboard"
        options={{
          title: 'Ranks',
          tabBarIcon: ({ color, size }) => (
            <Trophy size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <User size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="notifications"
        options={{ href: null }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: 'transparent',
    borderTopWidth: 1,
    borderTopColor: 'rgba(30,46,69,0.8)',
    height: Platform.OS === 'ios' ? 72 : 64,
    paddingTop: 6,
  },
  tabBg: {
    flex: 1,
    backgroundColor: 'rgba(8,12,20,0.97)',
  },
  tabLabel: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 10,
    marginTop: 2,
  },
  centreButtonWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  centreButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 10,
    marginBottom: 16,
  },
});

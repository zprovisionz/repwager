import { useEffect, useRef, Component } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { useFonts } from 'expo-font';
import { Inter_400Regular, Inter_500Medium, Inter_700Bold } from '@expo-google-fonts/inter';
import { Orbitron_500Medium, Orbitron_700Bold } from '@expo-google-fonts/orbitron';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { getProfile } from '@/services/profile.service';
import { registerPushToken } from '@/services/notification.service';
import ToastContainer from '@/components/ui/ToastContainer';
import { Platform, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { Subscription } from 'expo-notifications';
import type { ReactNode, ErrorInfo } from 'react';

interface ErrorBoundaryState { hasError: boolean; error: Error | null }
interface ErrorBoundaryProps { children: ReactNode }

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Errors silently swallowed in production
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={ebStyles.container}>
          <Text style={ebStyles.title}>Something went wrong</Text>
          <Text style={ebStyles.body}>{this.state.error?.message ?? 'An unexpected error occurred.'}</Text>
          <TouchableOpacity
            style={ebStyles.btn}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={ebStyles.btnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const ebStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080C14',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  title: { fontFamily: 'Inter-Bold', fontSize: 20, color: '#F0F4FF', textAlign: 'center' },
  body: { fontFamily: 'Inter-Regular', fontSize: 14, color: '#8A9DC0', textAlign: 'center', lineHeight: 22 },
  btn: {
    backgroundColor: '#00D4FF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
    marginTop: 8,
  },
  btnText: { fontFamily: 'Inter-Bold', fontSize: 15, color: '#080C14' },
});

SplashScreen.preventAutoHideAsync();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return null;

    const tokenData = await Notifications.getExpoPushTokenAsync();
    return tokenData.data;
  } catch {
    return null;
  }
}

function OnboardingGate() {
  const { profile, session } = useAuthStore();
  const router = require('expo-router').useRouter();

  useEffect(() => {
    if (!session || !profile) return;
    if (!(profile as any).has_completed_onboarding) {
      router.replace('/onboarding');
    }
  }, [session, profile]);

  return null;
}

export default function RootLayout() {
  useFrameworkReady();

  const { setSession, setProfile, setLoading } = useAuthStore();
  const notificationListener = useRef<Subscription | undefined>(undefined);
  const responseListener = useRef<Subscription | undefined>(undefined);

  const [fontsLoaded, fontError] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-Bold': Inter_700Bold,
    'Orbitron-Medium': Orbitron_500Medium,
    'Orbitron-Bold': Orbitron_700Bold,
  });

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        setSession(session);
        if (session?.user) {
          try {
            const p = await getProfile(session.user.id);
            setProfile(p);
            const token = await registerForPushNotificationsAsync();
            if (token) {
              registerPushToken(session.user.id, token).catch(() => {});
            }
          } catch {
            setProfile(null);
          }
        } else {
          setProfile(null);
        }
        setLoading(false);
      })();
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        getProfile(session.user.id)
          .then((p) => setProfile(p))
          .catch(() => setProfile(null))
          .finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    notificationListener.current = Notifications.addNotificationReceivedListener(
      (_notification) => {
        // Notification received while app in foreground
      }
    );

    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (_response) => {
        // User tapped notification
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <ErrorBoundary>
      <OnboardingGate />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#080C14' } }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="match/[id]" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="match/results" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="match/reveal" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="challenge/create" options={{ presentation: 'modal' }} />
        <Stack.Screen name="theatre/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="leagues" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="light" />
      <ToastContainer />
    </ErrorBoundary>
  );
}

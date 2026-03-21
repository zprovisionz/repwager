import { useEffect, useRef, Component } from 'react';
import { Stack, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { useFonts } from 'expo-font';
import { Barlow_400Regular, Barlow_500Medium, Barlow_700Bold } from '@expo-google-fonts/barlow';
import {
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
  BarlowCondensed_900Black,
} from '@expo-google-fonts/barlow-condensed';
import { legacyColors } from '@/constants/theme';
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
    backgroundColor: legacyColors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  title: { fontFamily: 'Barlow_700Bold', fontSize: 20, color: legacyColors.text, textAlign: 'center' },
  body: {
    fontFamily: 'Barlow_400Regular',
    fontSize: 14,
    color: legacyColors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  btn: {
    backgroundColor: legacyColors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
    marginTop: 8,
  },
  btnText: { fontFamily: 'Barlow_700Bold', fontSize: 15, color: legacyColors.textInverse },
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

function AuthGate() {
  const pathname = usePathname();
  const router = useRouter();
  const { authStage, isLoading } = useAuthStore();

  useEffect(() => {
    if (isLoading) return;
    const inAuth = pathname.startsWith('/(auth)');

    if (authStage === 'signed_out' && !inAuth) {
      router.replace('/(auth)');
      return;
    }
    if (authStage === 'needs_email_verification' && pathname !== '/(auth)/verify-email') {
      router.replace('/(auth)/verify-email');
      return;
    }
    if (authStage === 'needs_username' && pathname !== '/(auth)/username-setup') {
      router.replace('/(auth)/username-setup');
      return;
    }
    if (authStage === 'authenticated' && inAuth) {
      router.replace('/(tabs)');
    }
  }, [authStage, pathname, isLoading]);

  return null;
}

export default function RootLayout() {
  useFrameworkReady();

  const { setSession, setProfile, setLoading, hydrateAuth } = useAuthStore();
  const notificationListener = useRef<Subscription | undefined>(undefined);
  const responseListener = useRef<Subscription | undefined>(undefined);

  const [fontsLoaded, fontError] = useFonts({
    Barlow_400Regular: Barlow_400Regular,
    Barlow_500Medium: Barlow_500Medium,
    Barlow_700Bold: Barlow_700Bold,
    BarlowCondensed_600SemiBold: BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold: BarlowCondensed_700Bold,
    BarlowCondensed_900Black: BarlowCondensed_900Black,
  });

  useEffect(() => {
    hydrateAuth();

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
      <AuthGate />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: legacyColors.bg },
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="match/[id]" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="match/results" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="match/reveal" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="match/result" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="challenge/create" options={{ presentation: 'modal' }} />
        <Stack.Screen name="challenge/search" options={{ presentation: 'modal' }} />
        <Stack.Screen name="challenge/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="theatre/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="leagues" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="light" />
      <ToastContainer />
    </ErrorBoundary>
  );
}

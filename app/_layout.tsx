import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { useFonts } from 'expo-font';
import { Inter_400Regular, Inter_500Medium, Inter_700Bold } from '@expo-google-fonts/inter';
import { Orbitron_500Medium, Orbitron_700Bold } from '@expo-google-fonts/orbitron';
import * as SplashScreen from 'expo-splash-screen';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { getProfile } from '@/services/profile.service';
import ToastContainer from '@/components/ui/ToastContainer';
import { DevPanel } from '@/components/DevPanel';
import { DEV_MODE_ENABLED } from '@/lib/config';
import { setupDevConsole } from '@/lib/devConsole';

SplashScreen.preventAutoHideAsync();

// Initialize dev console helpers
if (DEV_MODE_ENABLED) {
  setupDevConsole();
}

export default function RootLayout() {
  useFrameworkReady();

  const { setSession, setProfile, setLoading } = useAuthStore();

  const [fontsLoaded, fontError] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-Bold': Inter_700Bold,
    'Orbitron-Medium': Orbitron_500Medium,
    'Orbitron-Bold': Orbitron_700Bold,
  });

  useEffect(() => {
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

    supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        setSession(session);
        if (session?.user) {
          try {
            const p = await getProfile(session.user.id);
            setProfile(p);
          } catch {
            setProfile(null);
          }
        } else {
          setProfile(null);
        }
        setLoading(false);
      })();
    });
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#080C14' } }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="match/[id]" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="match/results" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="challenge/create" options={{ presentation: 'modal' }} />
        <Stack.Screen name="theatre/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="light" />
      <ToastContainer />
      {DEV_MODE_ENABLED && <DevPanel />}
    </>
  );
}

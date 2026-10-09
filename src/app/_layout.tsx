import '@/i18n';

import {
  Cairo_400Regular,
  Cairo_500Medium,
  Cairo_600SemiBold,
  Cairo_700Bold,
  useFonts,
} from '@expo-google-fonts/cairo';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import type { ReactNode } from 'react';

import { SessionProvider, useSession } from '@/features/auth/session-context';

const PUBLIC_SEGMENTS = new Set(['login', 'signup']);

/**
 * Renvoie vers /login dès que la session disparaît (déconnexion, expiration),
 * quel que soit l'écran affiché au moment où ça arrive.
 */
function AuthGate({ children }: { children: ReactNode }) {
  const { session, isLoading, configError } = useSession();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading || configError) return;
    const onPublicScreen = PUBLIC_SEGMENTS.has(segments[0] ?? '');
    if (!session && !onPublicScreen) {
      router.replace('/login');
    }
  }, [session, isLoading, configError, segments]);

  return children;
}

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded] = useFonts({
    Cairo_400Regular,
    Cairo_500Medium,
    Cairo_600SemiBold,
    Cairo_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <AuthGate>
            <Stack screenOptions={{ headerShown: false }} />
          </AuthGate>
        </ThemeProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}

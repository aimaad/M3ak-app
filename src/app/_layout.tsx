import '@/global.css';
import '@/i18n';

import {
  Cairo_400Regular,
  Cairo_500Medium,
  Cairo_600SemiBold,
  Cairo_700Bold,
  useFonts,
} from '@expo-google-fonts/cairo';
import {
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DefaultTheme, router, Stack, ThemeProvider, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import type { ReactNode } from 'react';

import { DesktopShell } from '@/components/desktop-shell';
import { UndoProvider } from '@/components/undo-toast';
import { useAgencyAccess } from '@/features/agency/hooks';
import { SessionProvider, useSession } from '@/features/auth/session-context';
import { NotificationsBootstrap } from '@/features/notifications/notifications-bootstrap';

const PUBLIC_SEGMENTS = new Set(['login', 'signup', 'mot-de-passe-oublie']);

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

/**
 * Ferme l'application dès que l'accès de l'agence est expiré ou suspendu (le serveur refuse déjà
 * toutes les données ; ici on affiche simplement l'écran explicatif).
 */
function AccessGate({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const access = useAgencyAccess();
  const segments = useSegments();
  const onBlockedScreen = segments[0] === 'acces-bloque';

  useEffect(() => {
    if (!session || !access.data) return;
    if (!access.data.hasAccess && !onBlockedScreen) {
      router.replace('/acces-bloque');
    }
  }, [session, access.data, onBlockedScreen]);

  return children;
}

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Cairo_400Regular,
    Cairo_500Medium,
    Cairo_600SemiBold,
    Cairo_700Bold,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
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
        <ThemeProvider value={DefaultTheme}>
          <AuthGate>
            <AccessGate>
              <UndoProvider>
                <DesktopShell>
                  <Stack screenOptions={{ headerShown: false }} />
                </DesktopShell>
                <NotificationsBootstrap />
              </UndoProvider>
            </AccessGate>
          </AuthGate>
        </ThemeProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}

import { useSegments } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle } from 'react-native-reanimated';

import { curtainTop, endOpening, openingTime, useOpeningStatus } from './opening-store';
import { OPENING_PHASES } from './opening-timeline';

const CURTAIN = '#171126';
/** Si le hero n'est pas prêt après ce délai (réseau lent, erreur), on abandonne l'ouverture. */
const WAIT_LIMIT_MS = 4000;
const PUBLIC_SEGMENTS = new Set(['login', 'signup', 'mot-de-passe-oublie']);

/**
 * Enveloppe de l'application : pose un rideau sombre (plein écran tant que le hero n'est pas prêt, puis seulement sous le hero)
 * et abandonne l'ouverture au moindre toucher ou changement d'écran. Elle ne bloque jamais les touches.
 */
export function OpeningGate({ children }: { children: ReactNode }) {
  const status = useOpeningStatus();
  const segments = useSegments();
  const first = segments[0] as string | undefined;
  const onPublicScreen = PUBLIC_SEGMENTS.has(first ?? '');
  const onHome =
    first === undefined || (first === '(tabs)' && (segments as string[])[1] === 'accueil');
  const away = !onPublicScreen && !onHome;

  // Autre écran que l'Accueil (profil, chat…) : plus d'ouverture.
  useEffect(() => {
    if (status !== 'idle' && away) endOpening();
  }, [status, away]);

  // Garde-fou : le hero doit être prêt rapidement (le décompte ne tourne pas sur les écrans de connexion).
  useEffect(() => {
    if (status !== 'armed' || onPublicScreen) return;
    const timer = setTimeout(endOpening, WAIT_LIMIT_MS);
    return () => clearTimeout(timer);
  }, [status, onPublicScreen]);

  const style = useAnimatedStyle(() => ({
    top: curtainTop.value,
    opacity: interpolate(
      openingTime.value,
      [OPENING_PHASES.awakeningStart + 50, OPENING_PHASES.awakeningStart + 450],
      [1, 0],
      Extrapolation.CLAMP
    ),
  }));

  return (
    <View style={{ flex: 1 }} onTouchStart={status === 'idle' ? undefined : endOpening}>
      {children}
      {status !== 'idle' && !onPublicScreen ? (
        <Animated.View
          pointerEvents="none"
          style={[
            { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: CURTAIN },
            style,
          ]}
        />
      ) : null}
    </View>
  );
}

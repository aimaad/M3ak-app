import { useSegments } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import { runOnJS, useAnimatedReaction } from 'react-native-reanimated';

import { touchSkips } from './opening-state';
import { endOpening, openingTime, triggerEngineSound, useOpeningStatus } from './opening-store';
import { IGN } from './opening-timeline';
import { IgnitionStage } from './ignition-stage';

/** Si le hero n'est pas prêt après ce délai (réseau lent, erreur, image absente), on abandonne l'ouverture. */
const WAIT_LIMIT_MS = 4000;
const PUBLIC_SEGMENTS = new Set(['login', 'signup', 'mot-de-passe-oublie']);

/**
 * Enveloppe de l'application : porte la scène d'introduction, déclenche le son moteur à l'instant exact prévu sur la
 * chronologie, et abandonne l'ouverture au toucher ou au changement d'écran. Elle ne bloque jamais les touches.
 */
export function OpeningGate({ children }: { children: ReactNode }) {
  const status = useOpeningStatus();
  const segments = useSegments();
  const first = segments[0] as string | undefined;
  const onPublicScreen = PUBLIC_SEGMENTS.has(first ?? '');
  const onHome =
    first === undefined || (first === '(tabs)' && (segments as string[])[1] === 'accueil');
  const away = !onPublicScreen && !onHome;

  // Autre écran que l'Accueil : plus d'ouverture.
  useEffect(() => {
    if (status !== 'idle' && away) endOpening('aborted');
  }, [status, away]);

  // Garde-fou : le hero doit être prêt rapidement (le décompte ne tourne pas sur les écrans de connexion).
  useEffect(() => {
    if (status !== 'armed' || onPublicScreen) return;
    const timer = setTimeout(() => endOpening('aborted'), WAIT_LIMIT_MS);
    return () => clearTimeout(timer);
  }, [status, onPublicScreen]);

  // Le moteur démarre à l'instant précis (sur l'horloge de l'animation) prévu par le scénario.
  useAnimatedReaction(
    () => openingTime.value >= IGN.soundAt,
    (now, previous) => {
      if (now && previous === false) runOnJS(triggerEngineSound)();
    }
  );

  return (
    <View
      style={{ flex: 1 }}
      onTouchStart={touchSkips(status) ? () => endOpening('skipped') : undefined}
    >
      {children}
      {status !== 'idle' && !onPublicScreen ? <IgnitionStage /> : null}
    </View>
  );
}

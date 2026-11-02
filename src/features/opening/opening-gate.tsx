import { useSegments } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
} from 'react-native-reanimated';

import { CarLights } from '@/features/dashboard/car-lights';
import { carRect, carStartRect, rectCenter } from '@/features/dashboard/hero-layout';

import { touchSkips } from './opening-state';
import {
  curtainTop,
  endOpening,
  getHeroHeight,
  getOpeningMode,
  openingTime,
  triggerEngineSound,
  useOpeningStatus,
} from './opening-store';
import { easeInOut, FIRST, soundTimeOf, windowProgress } from './opening-timeline';

const CURTAIN = '#100B19';
/** Si le hero n'est pas prêt après ce délai (réseau lent, erreur), on abandonne l'ouverture. */
const WAIT_LIMIT_MS = 4000;
const PUBLIC_SEGMENTS = new Set(['login', 'signup', 'mot-de-passe-oublie']);

/**
 * Enveloppe de l'application : pose le rideau (noir aubergine plein écran tant que le hero n'est pas prêt, puis seulement sous
 * le hero), porte la voiture du premier lancement (centrée à l'écran puis glissant vers le hero), déclenche le son moteur à
 * l'instant exact de l'allumage, et abandonne l'ouverture au toucher (premier lancement) ou au changement d'écran.
 * Elle ne bloque jamais les touches.
 */
export function OpeningGate({ children }: { children: ReactNode }) {
  const status = useOpeningStatus();
  const mode = getOpeningMode();
  const segments = useSegments();
  const first = segments[0] as string | undefined;
  const onPublicScreen = PUBLIC_SEGMENTS.has(first ?? '');
  const onHome =
    first === undefined || (first === '(tabs)' && (segments as string[])[1] === 'accueil');
  const away = !onPublicScreen && !onHome;

  // Autre écran que l'Accueil : plus d'ouverture (la première reste non mémorisée si elle n'a pas été vue).
  useEffect(() => {
    if (status !== 'idle' && away) endOpening('aborted');
  }, [status, away]);

  // Garde-fou : le hero doit être prêt rapidement (le décompte ne tourne pas sur les écrans de connexion).
  useEffect(() => {
    if (status !== 'armed' || onPublicScreen) return;
    const timer = setTimeout(() => endOpening('aborted'), WAIT_LIMIT_MS);
    return () => clearTimeout(timer);
  }, [status, onPublicScreen]);

  // Le moteur démarre à l'instant précis (sur l'horloge de l'animation) où les phares commencent à s'allumer.
  const soundAt = soundTimeOf(mode);
  useAnimatedReaction(
    () => openingTime.value >= soundAt,
    (now, previous) => {
      if (now && previous === false) runOnJS(triggerEngineSound)();
    }
  );

  const curtain = useAnimatedStyle(() => {
    const awake = mode === 'first' ? FIRST.awakeningStart : 0;
    return {
      top: curtainTop.value,
      opacity:
        mode === 'first'
          ? interpolate(openingTime.value, [awake + 50, awake + 420], [1, 0], Extrapolation.CLAMP)
          : 0,
    };
  });

  return (
    <View
      style={{ flex: 1 }}
      onTouchStart={touchSkips(mode, status) ? () => endOpening('skipped') : undefined}
    >
      {children}
      {status !== 'idle' && !onPublicScreen && mode === 'first' ? (
        <>
          <Animated.View
            pointerEvents="none"
            style={[
              { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: CURTAIN },
              curtain,
            ]}
          />
          {status === 'playing' ? <FirstIgnitionCar /> : null}
        </>
      ) : null}
    </View>
  );
}

/**
 * La voiture du premier lancement : au centre de l'écran puis jusqu'à sa place dans le hero (position et échelle uniquement,
 * mêmes pixels que la voiture du hero qui prend le relais à l'arrivée).
 */
function FirstIgnitionCar() {
  const { width, height } = useWindowDimensions();
  const heroHeight = getHeroHeight();
  const end = carRect(width, heroHeight);
  const start = carStartRect(width, height);
  const from = rectCenter(start);
  const to = rectCenter(end);
  const scale0 = start.width / end.width;

  const place = useAnimatedStyle(() => {
    const p = easeInOut(windowProgress(openingTime.value, FIRST.arrivalStart, FIRST.arrivalEnd));
    const k = 1 - p;
    return {
      // Raccord : le calque disparaît à l'instant où la voiture du hero (identique) apparaît.
      opacity: openingTime.value >= FIRST.arrivalEnd ? 0 : 1,
      transform: [
        { translateX: (from.x - to.x) * k },
        { translateY: (from.y - to.y) * k },
        { scale: 1 + (scale0 - 1) * k },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: end.left,
          top: end.top,
          width: end.width,
          height: end.height,
        },
        place,
      ]}
    >
      <CarLights width={end.width} height={end.height} mode="first" effects />
    </Animated.View>
  );
}

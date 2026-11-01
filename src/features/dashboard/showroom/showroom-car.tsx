import { useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import {
  centerIndex,
  frameOpacity,
  framePosition,
  mountedRange,
  shouldRunShowroom,
  swing,
} from './showroom-math';
import type { ImageSourcePropType } from 'react-native';

export type CarBox = { left: number; top: number; width: number; height: number };

/** Une image de la séquence : son opacité se calcule sur le fil d'interface à partir de la position `f`. */
function CarFrame({
  source,
  index,
  f,
  onLoad,
  onError,
}: {
  source: ImageSourcePropType;
  index: number;
  f: SharedValue<number>;
  onLoad?: () => void;
  onError: () => void;
}) {
  const style = useAnimatedStyle(() => ({ opacity: frameOpacity(index, f.value) }));
  return (
    <Animated.Image
      source={source}
      resizeMode="contain"
      // `resize` : Android décode l'image à la taille affichée (et non en pleine résolution) ; `fadeDuration` : pas de fondu
      // automatique d'Android à l'affichage, qui ferait « respirer » la voiture.
      resizeMethod="resize"
      fadeDuration={0}
      onLoad={onLoad}
      onError={onError}
      accessible={false}
      style={[StyleSheet.absoluteFill, style]}
    />
  );
}

/**
 * Voiture qui pivote doucement de −8° à +8° puis revient (séquence d'images, jamais de tour complet), posée à l'emplacement de
 * la voiture de la photo. Seule la voiture bouge.
 *
 * Performance : une seule horloge sur le fil d'interface (`useFrameCallback`) calcule la position ; chaque image n'a qu'une
 * opacité animée ; seules quelques images voisines de la position courante sont montées (mémoire bornée) et JS ne fait rien
 * pendant l'animation hormis un changement d'état environ 7 fois par seconde.
 *
 * Suspension : l'horloge s'arrête (sans repartir de zéro) dès que l'écran n'est plus affiché, que l'application passe en
 * arrière-plan, ou que le hero est sorti de l'écran. Animations réduites : le composant n'est pas utilisé (photo fixe).
 */
export function ShowroomCar({
  frames,
  box,
  scrollY,
  heroHeight,
  onReady,
  onFail,
}: {
  frames: ImageSourcePropType[];
  box: CarBox;
  scrollY?: SharedValue<number>;
  heroHeight: number;
  /** Appelé quand l'image centrale (0°) est chargée : le fond peut alors passer à la version sans voiture. */
  onReady: () => void;
  /** Appelé si une image ne se charge pas : le hero revient à la photo fixe. */
  onFail: () => void;
}) {
  const count = frames.length;
  const center = centerIndex(count);
  const reduceMotion = useReducedMotion();
  const focused = useIsFocused();
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [heroVisible, setHeroVisible] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [base, setBase] = useState(center);

  const f = useSharedValue(center);
  const elapsed = useSharedValue(0);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) =>
      setAppActive(state === 'active')
    );
    return () => subscription.remove();
  }, []);

  // Le hero n'est plus à l'écran dès que la page a défilé de plus de sa hauteur : l'état ne change qu'à ce passage.
  useAnimatedReaction(
    () => (scrollY ? scrollY.value < heroHeight - 40 : true),
    (visible, previous) => {
      if (visible !== previous) runOnJS(setHeroVisible)(visible);
    },
    [heroHeight]
  );

  // Horloge unique sur le fil d'interface : elle cumule le temps uniquement tant qu'elle est active (reprise là où elle s'est arrêtée).
  const clock = useFrameCallback((frame) => {
    elapsed.value += frame.timeSincePreviousFrame ?? 0;
    f.value = framePosition(swing(elapsed.value), count);
  }, false);

  useEffect(() => {
    clock.setActive(shouldRunShowroom({ focused, appActive, heroVisible, reduceMotion, loaded }));
  }, [clock, focused, appActive, heroVisible, reduceMotion, loaded]);

  // Seul changement d'état JS : l'image « du dessous » change, environ 7 fois par seconde pour 25 images.
  useAnimatedReaction(
    () => Math.floor(f.value),
    (current, previous) => {
      if (current !== previous) runOnJS(setBase)(current);
    }
  );

  const [from, to] = mountedRange(base, count);
  const mounted: number[] = [];
  for (let i = from; i <= to; i++) mounted.push(i);

  return (
    <View
      pointerEvents="none"
      // Invisible tant que l'image centrale n'est pas chargée : on voit alors la photo fixe, sans doublon de voiture.
      style={{
        position: 'absolute',
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        opacity: loaded ? 1 : 0,
      }}
      renderToHardwareTextureAndroid
    >
      {mounted.map((index) => (
        <CarFrame
          key={index}
          source={frames[index]}
          index={index}
          f={f}
          onLoad={
            index === center
              ? () => {
                  setLoaded(true);
                  onReady();
                }
              : undefined
          }
          onError={onFail}
        />
      ))}
    </View>
  );
}

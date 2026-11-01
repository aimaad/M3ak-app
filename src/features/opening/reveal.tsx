import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { openingTime } from './opening-store';
import { easeOut, windowProgress } from './opening-timeline';

/**
 * Apparition d'un élément pendant l'ouverture : fondu + très léger mouvement vers le haut entre `from` et `to` (ms).
 * Hors ouverture l'horloge est à la fin : l'élément est simplement visible (aucun coût, aucune différence de mise en page).
 */
export function useReveal(from: number, to: number, rise = 8) {
  return useAnimatedStyle(() => {
    const p = easeOut(windowProgress(openingTime.value, from, to));
    return { opacity: p, transform: [{ translateY: (1 - p) * rise }] };
  });
}

export function Reveal({
  from,
  to,
  rise,
  style,
  children,
}: {
  from: number;
  to: number;
  rise?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const reveal = useReveal(from, to, rise);
  return <Animated.View style={[style, reveal]}>{children}</Animated.View>;
}

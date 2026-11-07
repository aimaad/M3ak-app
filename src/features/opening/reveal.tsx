import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { openingTime } from './opening-store';
import { easeOut, revealWindow, windowProgress, type RevealSlot } from './opening-timeline';

/**
 * Apparition d'un élément du dashboard pendant l'ouverture : fondu + très léger mouvement vers le haut, à l'heure prévue.
 * Hors ouverture l'horloge est « terminée » : l'élément est simplement visible (aucune différence de mise en page, aucun coût).
 */
export function useReveal(slot: RevealSlot, rise = 8) {
  const { from, to, start } = revealWindow(slot);
  return useAnimatedStyle(() => {
    const p = easeOut(windowProgress(openingTime.value, from, to));
    return { opacity: start + (1 - start) * p, transform: [{ translateY: (1 - p) * rise }] };
  });
}

export function Reveal({
  slot,
  rise,
  style,
  children,
}: {
  slot: RevealSlot;
  rise?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const reveal = useReveal(slot, rise);
  return <Animated.View style={[style, reveal]}>{children}</Animated.View>;
}

import { useCallback, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent, ScrollViewInstance } from 'react-native';

/** Ce dont on a besoin d'un champ : sa position à l'écran. */
type MeasurableNode = { measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => void };

/**
 * Défilement jusqu'à un champ (premier champ en erreur après « Enregistrer », ou champ demandé à l'ouverture). Chaque champ s'enregistre
 * par sa clé ; la position est mesurée à l'écran puis ramenée dans la page, avec une marge pour ne pas coller au haut de l'écran.
 */
export function useFieldScroll(topOffset = 96) {
  const scrollRef = useRef<ScrollViewInstance>(null);
  const scrollY = useRef(0);
  const fields = useRef<Record<string, MeasurableNode | null>>({});

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.current = event.nativeEvent.contentOffset.y;
  }, []);

  const register = useCallback(
    (key: string) => (node: MeasurableNode | null) => {
      fields.current[key] = node;
    },
    []
  );

  const scrollTo = useCallback(
    (key: string) => {
      const node = fields.current[key];
      if (!node) return;
      node.measureInWindow((_x: number, y: number) => {
        scrollRef.current?.scrollTo({ y: Math.max(0, scrollY.current + y - topOffset), animated: true });
      });
    },
    [topOffset]
  );

  return { scrollRef, onScroll, register, scrollTo };
}

import { useCallback, useRef } from 'react';
import type { LayoutChangeEvent, ScrollViewInstance } from 'react-native';

/** Sections de la fiche véhicule qu'on peut ouvrir directement (« Voir l'entretien », rond appareil photo, cartes « À surveiller »). */
export type VehicleSection = 'photos' | 'documents' | 'entretien';

/** Paramètre d'adresse `?section=…` → section connue, sinon null (une valeur inconnue n'a aucun effet). */
export function parseVehicleSection(value: string | string[] | undefined): VehicleSection | null {
  const single = Array.isArray(value) ? value[0] : value;
  return single === 'photos' || single === 'documents' || single === 'entretien' ? single : null;
}

/**
 * Fait défiler la fiche jusqu'à la section demandée dès qu'elle est mise en page. Si le contenu au-dessus grandit ensuite (photos qui
 * se chargent), la section est rattrapée, jusqu'à ce que l'utilisateur fasse défiler lui-même.
 */
export function useSectionScroll(section: VehicleSection | null) {
  const scrollRef = useRef<ScrollViewInstance>(null);
  const userScrolled = useRef(false);

  const onSectionLayout = useCallback(
    (name: VehicleSection) => (event: LayoutChangeEvent) => {
      if (section !== name || userScrolled.current) return;
      scrollRef.current?.scrollTo({ y: Math.max(0, event.nativeEvent.layout.y - 12), animated: true });
    },
    [section]
  );
  const onScrollBeginDrag = useCallback(() => {
    userScrolled.current = true;
  }, []);

  return { scrollRef, onSectionLayout, onScrollBeginDrag };
}

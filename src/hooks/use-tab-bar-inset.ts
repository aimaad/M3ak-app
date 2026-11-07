import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDesktopLayout } from './use-desktop-layout';

/** Hauteur de la barre du bas flottante et son écart au bord de l'écran (hors zone de sécurité). */
export const TAB_BAR_HEIGHT = 68;
export const TAB_BAR_BOTTOM_GAP = 26;
export const TAB_BAR_SIDE_GAP = 16;

/**
 * Marge à laisser en bas du contenu d'un écran à onglets pour que la barre flottante ne cache rien :
 * hauteur de la barre + écart au bord + zone de sécurité + un peu d'air. Nulle sur grand écran web (menu latéral).
 */
export function useTabBarInset(): number {
  const insets = useSafeAreaInsets();
  const isDesktop = useDesktopLayout();
  return isDesktop ? 0 : TAB_BAR_HEIGHT + TAB_BAR_BOTTOM_GAP + insets.bottom + 16;
}

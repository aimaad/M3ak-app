import { Platform, useWindowDimensions } from 'react-native';

/** Largeur à partir de laquelle la version web passe en mise en page « bureau » (menu latéral, tableaux). */
export const DESKTOP_MIN_WIDTH = 1024;

/** Vrai uniquement dans un navigateur assez large : l'app mobile n'est jamais concernée. */
export function useDesktopLayout(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= DESKTOP_MIN_WIDTH;
}

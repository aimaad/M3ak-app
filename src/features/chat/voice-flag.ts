import { Platform } from 'react-native';

/**
 * Le vocal (micro, enregistrement, lecture) est disponible sur téléphone. Sur le web, l'enregistrement n'est pas dans un format
 * accepté par le serveur : pas de micro (aperçu possible avec EXPO_PUBLIC_VOICE_WEB_PREVIEW=1, pour les captures d'écran).
 */
export const VOICE_ENABLED = Platform.OS !== 'web' || process.env.EXPO_PUBLIC_VOICE_WEB_PREVIEW === '1';

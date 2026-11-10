import { Platform } from 'react-native';

/**
 * Le vocal (bouton micro de l'historique et de la conversation, mode vocal) est DÉSACTIVÉ pour l'instant : le chat est écrit seulement.
 * Le code du mode vocal reste dans l'app (écrans `chat/vocal` et `chat/vocal-turns`, dossier `features/chat/live`) pour le réactiver plus tard
 * sans rien réécrire : mettre EXPO_PUBLIC_VOICE_ENABLED=1 dans `.env` (puis `npx expo start --clear`).
 * Sur le web, l'enregistrement n'est pas dans un format accepté par le serveur : pas de micro (aperçu possible avec
 * EXPO_PUBLIC_VOICE_WEB_PREVIEW=1, pour les captures d'écran).
 */
export const VOICE_ENABLED = process.env.EXPO_PUBLIC_VOICE_ENABLED === '1' && (Platform.OS !== 'web' || process.env.EXPO_PUBLIC_VOICE_WEB_PREVIEW === '1');

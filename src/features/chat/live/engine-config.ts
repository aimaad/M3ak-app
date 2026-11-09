/**
 * Adresse du « moteur vocal » : la page qui capte le micro en continu et joue la voix, affichée dans une fenêtre web interne de l'app
 * (le téléphone sait le faire dans Expo Go, ce que les modules audio de l'app ne savent pas). À changer dans `.env` :
 * EXPO_PUBLIC_VOCAL_ENGINE_URL=https://votre-site/ (HTTPS obligatoire pour le micro).
 */
export const VOCAL_ENGINE_URL = process.env.EXPO_PUBLIC_VOCAL_ENGINE_URL || 'https://bibip-vocal.netlify.app/';

/** Origine autorisée dans la fenêtre : le moteur et rien d'autre (aucune navigation vers un autre site). */
export function engineOrigin(url: string = VOCAL_ENGINE_URL): string {
  const match = /^(https:\/\/[^/?#]+)/i.exec(url);
  return match ? match[1].toLowerCase() : '';
}

/** Vrai si la fenêtre peut charger cette adresse : le moteur lui-même (ou une page vide interne). */
export function isAllowedEngineUrl(target: string, origin: string = engineOrigin()): boolean {
  if (target === 'about:blank') return true;
  if (origin === '') return false;
  const lower = target.toLowerCase();
  // Même origine EXACTE : après le nom de domaine, seulement la fin, « / », « ? » ou « # » (jamais « .evil.com » ni un port inattendu).
  return lower.startsWith(origin) && (lower.length === origin.length || /^[/?#]/.test(lower.slice(origin.length)));
}

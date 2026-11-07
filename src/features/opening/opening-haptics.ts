import { readHapticsEnabled } from './opening-storage';

/**
 * Vibration qui accompagne le moteur : des impulsions qui suivent l'enveloppe du son (`m3ak-engine-start.mp3`, 1,04 s) :
 * un coup franc au démarrage (l'éclat de lumière), une montée jusqu'au pic (≈ 0,28 s), la retombée, puis un ralenti discret.
 * Jamais plus fort que « moyen » : on la sent nettement sans qu'elle gêne. [décalage en ms depuis le début du son, intensité]
 */
export const ENGINE_HAPTICS = [
  [0, 'medium'],
  [45, 'medium'],
  [90, 'light'],
  [130, 'light'],
  [170, 'medium'],
  [205, 'medium'],
  [240, 'medium'],
  [275, 'medium'],
  [310, 'medium'],
  [350, 'light'],
  [395, 'light'],
  [445, 'light'],
  [500, 'soft'],
  [560, 'soft'],
  [630, 'soft'],
  [710, 'soft'],
  [800, 'soft'],
] as const;

type Haptics = typeof import('expo-haptics');

let haptics: Haptics | null = null;
let timers: ReturnType<typeof setTimeout>[] = [];
let played = false;

/**
 * Prépare la vibration (appel non bloquant). Sans module de vibration, l'ouverture reste simplement silencieuse côté toucher.
 * Interrupteur de diagnostic : EXPO_PUBLIC_DISABLE_OPENING_HAPTICS=1.
 */
export async function prepareEngineHaptics(): Promise<void> {
  try {
    if (process.env.EXPO_PUBLIC_DISABLE_OPENING_HAPTICS === '1') return;
    if (!(await readHapticsEnabled())) return;
    // Chargé à la demande : si le module natif manque, l'app démarre quand même.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    haptics = require('expo-haptics') as Haptics;
  } catch (error) {
    if (__DEV__) console.warn('[BIBIP] vibration du moteur indisponible :', error);
    haptics = null;
  }
}

/**
 * Lance la vibration du moteur. `delayMs` = délai de sortie audio du téléphone : la vibration est décalée d'autant pour être
 * ressentie en même temps que le son est entendu.
 */
export function playEngineHaptics(delayMs = 0): void {
  const module = haptics;
  if (!module) {
    // Visible dans le terminal d'Expo (développement) : permet de comprendre pourquoi on ne sent rien.
    if (__DEV__)
      console.warn('[BIBIP] vibration : module non prêt (coupée, ou expo-haptics non installé)');
    return;
  }
  if (played) return;
  played = true;
  if (__DEV__) console.log('[BIBIP] vibration du moteur lancée');
  timers = ENGINE_HAPTICS.map(([offset, intensity]) =>
    setTimeout(() => {
      const style =
        intensity === 'light' ? module.ImpactFeedbackStyle.Light : module.ImpactFeedbackStyle.Soft;
      module.impactAsync(style).catch((error) => {
        if (__DEV__) console.warn('[BIBIP] vibration refusée :', error);
      });
    }, delayMs + offset)
  );
}

/** Interrompt la vibration (introduction passée ou abandonnée). */
export function stopEngineHaptics(): void {
  timers.forEach(clearTimeout);
  timers = [];
}

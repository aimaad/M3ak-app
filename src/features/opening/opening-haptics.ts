import { readHapticsEnabled } from './opening-storage';

/**
 * Vibration qui accompagne le moteur : de petites impulsions douces qui suivent l'enveloppe du son (`m3ak-engine-start.mp3`,
 * 1,04 s) : démarrage doux, montée jusqu'au pic (≈ 0,28 s), retombée, puis ralenti discret. Jamais plus fort que « léger » :
 * l'effet doit se sentir sans jamais gêner. [décalage en ms depuis le début du son, intensité]
 */
export const ENGINE_HAPTICS = [
  [0, 'soft'],
  [40, 'soft'],
  [80, 'soft'],
  [110, 'soft'],
  [140, 'light'],
  [170, 'light'],
  [200, 'light'],
  [230, 'light'],
  [260, 'light'],
  [290, 'light'],
  [330, 'light'],
  [370, 'soft'],
  [410, 'soft'],
  [460, 'soft'],
  [530, 'soft'],
  [610, 'soft'],
  [700, 'soft'],
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
  if (!module || played) return;
  played = true;
  timers = ENGINE_HAPTICS.map(([offset, intensity]) =>
    setTimeout(() => {
      const style =
        intensity === 'light' ? module.ImpactFeedbackStyle.Light : module.ImpactFeedbackStyle.Soft;
      module.impactAsync(style).catch(() => {});
    }, delayMs + offset)
  );
}

/** Interrompt la vibration (introduction passée ou abandonnée). */
export function stopEngineHaptics(): void {
  timers.forEach(clearTimeout);
  timers = [];
}

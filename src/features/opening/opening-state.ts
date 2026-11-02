import type { OpeningMode } from './opening-timeline';

/**
 * États de l'ouverture : « idle » (rien à jouer, ou déjà jouée), « armed » (rideau posé, on attend que le hero soit prêt),
 * « playing » (chronologie en cours). L'ouverture ne se joue qu'une seule fois par lancement à froid de l'app.
 */
export type OpeningStatus = 'idle' | 'armed' | 'playing';

/** Fin d'une ouverture : terminée ou passée volontairement (on la mémorise), ou abandonnée (erreur, délai : on ne la mémorise pas). */
export type OpeningEnd = 'completed' | 'skipped' | 'aborted';

/** THE FIRST IGNITION tant qu'elle n'a jamais été vue ; si la mémoire est illisible, on reste sur la version courte. */
export function chooseMode(firstPlayed: boolean | null): OpeningMode {
  return firstPlayed === false ? 'first' : 'instant';
}

/** Arme l'ouverture si elle n'a pas déjà été jouée et si les animations ne sont pas réduites / l'écran n'est pas « bureau ». */
export function nextStatusOnArm(
  status: OpeningStatus,
  consumed: boolean,
  options: { reduceMotion: boolean; disabled: boolean }
): { status: OpeningStatus; consumed: boolean } {
  if (consumed || status !== 'idle') return { status, consumed };
  // Animations réduites ou écran bureau : on montre directement l'état final, sans rien mémoriser.
  if (options.reduceMotion || options.disabled) return { status: 'idle', consumed: true };
  return { status: 'armed', consumed: true };
}

/** Le chronomètre ne démarre que depuis l'état « armed ». */
export function nextStatusOnStart(status: OpeningStatus): OpeningStatus {
  return status === 'armed' ? 'playing' : status;
}

/** Fin ou abandon : toujours retour à « idle » (l'interface finale est alors affichée). */
export function nextStatusOnEnd(): OpeningStatus {
  return 'idle';
}

/** Seule une ouverture réellement vue (ou volontairement passée) compte comme « première ouverture faite ». */
export function shouldRememberFirst(mode: OpeningMode, end: OpeningEnd): boolean {
  return mode === 'first' && end !== 'aborted';
}

/** Un toucher passe la première introduction ; l'introduction courte ne bloque rien et n'est jamais interrompue. */
export function touchSkips(mode: OpeningMode, status: OpeningStatus): boolean {
  return mode === 'first' && status !== 'idle';
}

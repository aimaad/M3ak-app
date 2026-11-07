/**
 * États de l'ouverture : « idle » (rien à jouer, ou déjà jouée), « armed » (fond posé, on attend que le hero et les images
 * soient prêts), « playing » (chronologie en cours). Elle se joue une seule fois par lancement à froid de l'app.
 */
export type OpeningStatus = 'idle' | 'armed' | 'playing';

/** Fin d'une ouverture : terminée, passée par l'utilisateur, ou abandonnée (erreur, délai, changement d'écran). */
export type OpeningEnd = 'completed' | 'skipped' | 'aborted';

/** Arme l'ouverture si elle n'a pas déjà été jouée et si les animations ne sont pas réduites / l'écran n'est pas « bureau ». */
export function nextStatusOnArm(
  status: OpeningStatus,
  consumed: boolean,
  options: { reduceMotion: boolean; disabled: boolean }
): { status: OpeningStatus; consumed: boolean } {
  if (consumed || status !== 'idle') return { status, consumed };
  // Animations réduites ou écran bureau : on montre directement l'état final.
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

/** Un toucher passe l'introduction (elle ne bloque jamais l'accès au dashboard). */
export function touchSkips(status: OpeningStatus): boolean {
  return status !== 'idle';
}

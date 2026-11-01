/**
 * États de l'ouverture : « idle » (rien à jouer, ou déjà jouée), « armed » (rideau posé, on attend que le hero soit prêt),
 * « playing » (chronologie en cours). L'ouverture ne se joue qu'une seule fois par lancement de l'app.
 */
export type OpeningStatus = 'idle' | 'armed' | 'playing';

/** Arme l'ouverture si elle n'a pas déjà été jouée et si les animations ne sont pas réduites / l'écran n'est pas « bureau ». */
export function nextStatusOnArm(
  status: OpeningStatus,
  consumed: boolean,
  options: { reduceMotion: boolean; disabled: boolean }
): { status: OpeningStatus; consumed: boolean } {
  if (consumed || status !== 'idle') return { status, consumed };
  // Animations réduites ou écran bureau : on montre directement l'état final, et on considère l'ouverture comme jouée.
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

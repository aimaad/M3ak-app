/**
 * États de l'ouverture : « idle » (rien à jouer, ou déjà jouée), « armed » (fond noir posé, la vidéo se charge),
 * « playing » (vidéo en lecture). Elle se joue une seule fois par lancement à froid de l'app.
 */
export type OpeningStatus = 'idle' | 'armed' | 'playing';

/** Fin d'une ouverture : terminée, passée par l'utilisateur, ou abandonnée (erreur de lecture, délai). */
export type OpeningEnd = 'completed' | 'skipped' | 'aborted';

/** Arme l'ouverture si elle n'a pas déjà été jouée et si les animations ne sont pas réduites / l'écran n'est pas « bureau ». */
export function nextStatusOnArm(
  status: OpeningStatus,
  consumed: boolean,
  options: { reduceMotion: boolean; disabled: boolean }
): { status: OpeningStatus; consumed: boolean } {
  if (consumed || status !== 'idle') return { status, consumed };
  // Animations réduites ou écran bureau : on montre directement l'application.
  if (options.reduceMotion || options.disabled) return { status: 'idle', consumed: true };
  return { status: 'armed', consumed: true };
}

/** La lecture ne démarre que depuis l'état « armed ». */
export function nextStatusOnStart(status: OpeningStatus): OpeningStatus {
  return status === 'armed' ? 'playing' : status;
}

/** Fin ou abandon : toujours retour à « idle » (l'application est alors affichée). */
export function nextStatusOnEnd(): OpeningStatus {
  return 'idle';
}

/** Un toucher passe la vidéo tant qu'elle est affichée. */
export function touchSkips(status: OpeningStatus): boolean {
  return status !== 'idle';
}

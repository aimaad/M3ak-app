/**
 * Calculs purs de l'animation « showroom » de la voiture du hero (aucune dépendance native, testables sans téléphone).
 * Les fonctions marquées « worklet » tournent aussi sur le fil d'interface (Reanimated) pendant l'animation.
 */

export const SHOWROOM = {
  /** Plage de rotation de la voiture, en degrés : de −8° à +8° puis retour (jamais de tour complet). */
  minAngle: -8,
  maxAngle: 8,
  /** Durée d'un aller-retour complet, en millisecondes. */
  periodMs: 7000,
  /** Images conservées en mémoire de chaque côté de l'image courante (les autres ne sont pas montées). */
  mountRadius: 2,
  /** En dessous, la séquence est trop courte pour être fluide : on garde la photo fixe. */
  minFrames: 9,
} as const;

/**
 * Position lissée de 0 à 1 d'un aller-retour : part du centre (0,5 = 0°), va vers +8° (1), repasse par le centre, va vers
 * −8° (0) puis revient. Sinusoïdale : la voiture ralentit doucement aux deux extrémités, comme sur un plateau tournant.
 */
export function swing(elapsedMs: number, periodMs: number = SHOWROOM.periodMs): number {
  'worklet';
  const phase = (((elapsedMs % periodMs) + periodMs) % periodMs) / periodMs;
  return 0.5 + 0.5 * Math.sin(2 * Math.PI * phase);
}

/** Position fractionnaire dans la séquence (0 = première image, count − 1 = dernière). */
export function framePosition(position: number, count: number): number {
  'worklet';
  return Math.min(Math.max(position, 0), 1) * Math.max(count - 1, 0);
}

/** Angle de la voiture (en degrés) pour une position de 0 à 1. */
export function angleAt(position: number): number {
  'worklet';
  return (
    SHOWROOM.minAngle + (SHOWROOM.maxAngle - SHOWROOM.minAngle) * Math.min(Math.max(position, 0), 1)
  );
}

/**
 * Opacité de l'image `index` quand la séquence est à la position fractionnaire `f`. L'image du dessous (floor(f)) est pleine
 * et celle du dessus (floor(f) + 1) apparaît progressivement : c'est un vrai fondu entre deux images, sans zone « creuse »
 * là où deux images translucides se superposeraient.
 */
export function frameOpacity(index: number, f: number): number {
  'worklet';
  const base = Math.floor(f);
  if (index === base) return 1;
  if (index === base + 1) return f - base;
  return 0;
}

/** Intervalle d'images à garder montées autour de la position `f` (mémoire bornée, quel que soit le nombre d'images). */
export function mountedRange(
  f: number,
  count: number,
  radius: number = SHOWROOM.mountRadius
): [number, number] {
  const base = Math.floor(f);
  return [Math.max(0, base - radius), Math.min(count - 1, base + 1 + radius)];
}

/** Indice de l'image centrale (0°), par laquelle l'animation commence et qui sert à vérifier le chargement. */
export function centerIndex(count: number): number {
  return Math.round((Math.max(count, 1) - 1) / 2);
}

/** L'animation n'est possible que si la séquence et le fond sans voiture sont fournis. */
export function isShowroomAvailable(frameCount: number, hasBackground: boolean): boolean {
  return hasBackground && frameCount >= SHOWROOM.minFrames;
}

/**
 * L'animation tourne seulement si l'utilisateur la voit et ne l'a pas refusée : écran Accueil affiché, application au premier
 * plan, hero encore visible à l'écran, animations non réduites, images chargées.
 */
export function shouldRunShowroom(state: {
  focused: boolean;
  appActive: boolean;
  heroVisible: boolean;
  reduceMotion: boolean;
  loaded: boolean;
}): boolean {
  return (
    state.focused && state.appActive && state.heroVisible && !state.reduceMotion && state.loaded
  );
}

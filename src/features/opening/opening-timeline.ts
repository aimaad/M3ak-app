/**
 * Chronologie de l'ouverture (millisecondes, 3,7 s) : un seul geste, comme une vraie voiture qui s'éveille dans le noir.
 *
 *   0,0 – 0,9 s   l'écran est noir ; la silhouette de la voiture émerge à peine (fondu d'entrée très doux)
 *   0,9 – 2,1 s   la voiture s'allume progressivement (fondu continu entre les deux photos : phares, reflets sur le sol)
 *   2,1 s         le moteur démarre (son fourni, rogné de son bruit d'amorce) une fois la voiture allumée, avec une vibration douce
 *   3,0 – 3,7 s   le noir se retire en douceur sur l'application
 *
 * Une seule horloge (`openingTime`) pilote tout. Fonctions pures, utilisables dans les animations (« worklet »).
 */
/** Délai de sortie audio du téléphone (ms) : la vibration est décalée d'autant pour être ressentie avec le son. À ajuster à l'oreille. */
export const SOUND_LATENCY = 60;

export const IGN = {
  /** Fin du fondu d'entrée de la silhouette. */
  darkInEnd: 600,
  litStart: 900,
  litEnd: 2100,
  /** Le moteur démarre quand la voiture est allumée. */
  soundAt: 2100,
  fadeStart: 3000,
  end: 3700,
} as const;

/** Valeur de l'horloge quand il n'y a (plus) rien à jouer : au-delà de toutes les fenêtres, tout est à son état final. */
export const DONE_TIME = 10_000;

/** Avancement 0 → 1 d'une fenêtre [from, to] (borné). */
export function windowProgress(time: number, from: number, to: number): number {
  'worklet';
  if (to <= from) return time >= to ? 1 : 0;
  const p = (time - from) / (to - from);
  return p < 0 ? 0 : p > 1 ? 1 : p;
}

/** Démarrage et arrivée doux (aucun rebond). */
export function easeInOut(p: number): number {
  'worklet';
  return p * p * (3 - 2 * p);
}

/** Départ vif, arrivée très douce. */
export function easeOut(p: number): number {
  'worklet';
  const q = 1 - p;
  return 1 - q * q * q;
}

export type IgnitionCurves = {
  /** Opacité de la photo sombre (silhouette à peine visible). */
  dark: number;
  /** Opacité de la photo allumée, par-dessus (0 = éteinte, 1 = pleinement allumée). */
  lit: number;
  /** Opacité de l'ensemble de l'introduction (1 puis fondu vers l'application). */
  stage: number;
};

/** Courbes de l'ouverture pour un instant donné. */
export function ignitionCurves(t: number): IgnitionCurves {
  'worklet';
  return {
    dark: easeOut(windowProgress(t, 0, IGN.darkInEnd)),
    // Une seule courbe continue (lente au départ, rapide au milieu, très douce à l'arrivée) : pas de palier, pas de saccade.
    lit: easeInOut(windowProgress(t, IGN.litStart, IGN.litEnd)),
    stage: 1 - easeInOut(windowProgress(t, IGN.fadeStart, IGN.end)),
  };
}

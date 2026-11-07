/**
 * Chronologie de l'ouverture (millisecondes, 3,6 s) : une vraie voiture qui s'éveille dans le noir.
 *
 *   0,0 – 0,9 s   écran noir ; la silhouette de la voiture émerge à peine (fondu d'entrée très doux)
 *   1,5 s         les phares s'allument d'un seul coup (≈ 0,12 s), et le moteur démarre exactement à cet instant
 *   3,0 – 3,6 s   le noir se retire en douceur sur l'application
 *
 * Le son (`m3ak-engine-start.mp3`, 1,04 s, rogné pour commencer directement par la montée du moteur) est lancé avec une
 * avance `SOUND_LATENCY` qui compense le délai de sortie audio du téléphone : son et lumière sont perçus ensemble.
 * Une seule horloge (`openingTime`) pilote tout. Fonctions pures, utilisables dans les animations (« worklet »).
 */
const LIT_START = 1500;
/** Délai de sortie audio du téléphone (ms) : le son est lancé un peu avant la lumière. À ajuster à l'oreille si besoin. */
export const SOUND_LATENCY = 60;

export const IGN = {
  /** Fin du fondu d'entrée de la silhouette. */
  darkInEnd: 900,
  litStart: LIT_START,
  /** Les phares s'allument d'un seul coup : 120 ms. */
  litEnd: LIT_START + 120,
  /** Le moteur démarre à l'allumage (légèrement avant, pour la latence audio). */
  soundAt: LIT_START - SOUND_LATENCY,
  fadeStart: 3000,
  end: 3600,
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
    // Allumage franc et rapide (départ vif, arrivée douce) : les optiques s'allument d'un seul coup, comme sur une vraie voiture.
    lit: easeOut(windowProgress(t, IGN.litStart, IGN.litEnd)),
    stage: 1 - easeInOut(windowProgress(t, IGN.fadeStart, IGN.end)),
  };
}

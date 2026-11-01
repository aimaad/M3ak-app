/**
 * Chronologie de l'ouverture (millisecondes). Une seule horloge pilote tous les effets : chaque élément ne fait que lire
 * « où en est l'ouverture » et en déduit son opacité / sa position. Fonctions pures (utilisables dans les animations).
 */
export const OPENING_PHASES = {
  /** Phase 1 : obscurité. */
  darknessEnd: 500,
  /** Phase 2 : balayage de lumière violette, de la droite vers la gauche. */
  sweepStart: 500,
  sweepEnd: 1800,
  /** Phase 3 : les phares s'illuminent. */
  headlightsStart: 1800,
  headlightsEnd: 2300,
  /** Phase 4 : le logo naît d'une lueur, puis vole vers sa place. */
  emergenceStart: 2300,
  emergenceEnd: 2700,
  flightEnd: 3400,
  /** Phase 5 : le tableau de bord s'éveille. */
  awakeningStart: 3400,
  end: 4300,
} as const;

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

export type Point = { x: number; y: number };

/** Point d'une courbe de Bézier quadratique (trajectoire en arc du logo). */
export function quadraticPoint(start: Point, control: Point, end: Point, p: number): Point {
  'worklet';
  const q = 1 - p;
  return {
    x: q * q * start.x + 2 * q * p * control.x + p * p * end.x,
    y: q * q * start.y + 2 * q * p * control.y + p * p * end.y,
  };
}

/** Point de contrôle : le logo s'élève d'abord, puis s'incline vers sa place (trajectoire élégante, sans rebond). */
export function flightControl(start: Point, end: Point): Point {
  'worklet';
  return { x: start.x - (start.x - end.x) * 0.1, y: start.y - (start.y - end.y) * 0.8 };
}

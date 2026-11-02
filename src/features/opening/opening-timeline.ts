/**
 * Chronologies de l'ouverture (millisecondes). Une seule horloge (`openingTime`) pilote tous les effets : chaque calque ne fait
 * que lire « où en est l'ouverture » et en déduit son opacité / sa position. Fonctions pures, utilisables dans les animations.
 */
export type OpeningMode = 'first' | 'instant';

/** THE FIRST IGNITION : 3,8 s, une seule fois après l'installation. */
export const FIRST = {
  darknessEnd: 600,
  revealStart: 600,
  revealEnd: 1400,
  ignitionStart: 1400,
  ignitionEnd: 2100,
  arrivalStart: 2100,
  arrivalEnd: 3000,
  awakeningStart: 3000,
  end: 3800,
  /** Le moteur démarre exactement à l'allumage des phares. */
  soundAt: 1400,
} as const;

/** INSTANT IGNITION : 1,65 s à chaque lancement à froid suivant. */
export const INSTANT = {
  contactEnd: 250,
  ignitionStart: 250,
  ignitionEnd: 650,
  powerOnEnd: 1250,
  end: 1650,
  soundAt: 250,
} as const;

/** Valeur de l'horloge quand il n'y a (plus) rien à jouer : au-delà de toutes les fenêtres, donc tout est à son état final. */
export const DONE_TIME = 10_000;

export function durationOf(mode: OpeningMode): number {
  return mode === 'first' ? FIRST.end : INSTANT.end;
}

export function soundTimeOf(mode: OpeningMode): number {
  return mode === 'first' ? FIRST.soundAt : INSTANT.soundAt;
}

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

/**
 * Courbe par points-clés [[temps, valeur], …] : valeur constante avant le premier et après le dernier point,
 * transition douce (easeInOut) entre deux points.
 */
export function keys(time: number, points: readonly (readonly [number, number])[]): number {
  'worklet';
  const first = points[0];
  if (time <= first[0]) return first[1];
  for (let i = 1; i < points.length; i++) {
    const [t1, v1] = points[i];
    if (time <= t1) {
      const [t0, v0] = points[i - 1];
      const p = easeInOut((time - t0) / (t1 - t0));
      return v0 + (v1 - v0) * p;
    }
  }
  return points[points.length - 1][1];
}

export type CarCurves = {
  /** Assombrissement (0 = voiture visible, 1 = noire) de la zone déjà balayée / de toute la voiture. */
  dim: number;
  /** Assombrissement de la zone pas encore balayée (premier lancement uniquement). */
  dimAhead: number;
  /** Position horizontale (0 → 1, de la droite vers la gauche) du front de lumière ; hors [0,1] = hors de la voiture. */
  edge: number;
  /** Intensité de la bande de lumière violette au front. */
  band: number;
  /** Opacité de l'image « phares allumés ». */
  lit: number;
  /** Halo lavande autour des phares. */
  glow: number;
  /** Reflet violet qui renforce brièvement la carrosserie. */
  pulse: number;
  /** Impulsion violette sur le sol. */
  floor: number;
  /** Voile aubergine sur le showroom (0 = aucun). */
  veil: number;
  /** Lueur discrète autour du logo M3ak (Instant Ignition). */
  logoGlow: number;
};

/** Toutes les courbes d'effet de la voiture et du décor pour un instant donné. */
export function carCurves(mode: OpeningMode, t: number): CarCurves {
  'worklet';
  if (mode === 'first') {
    const sweep = easeInOut(windowProgress(t, FIRST.revealStart, FIRST.revealEnd));
    return {
      // Zone déjà balayée par la lumière : assez visible (45 %), puis pleinement éclairée à mesure que le showroom s'allume.
      dim: keys(t, [
        [FIRST.revealEnd, 0.45],
        [FIRST.ignitionEnd, 0.28],
        [FIRST.arrivalEnd, 0],
      ]),
      // Zone pas encore balayée : presque noire.
      dimAhead: 0.93,
      edge: 1.15 - 1.35 * sweep,
      band: keys(t, [
        [FIRST.revealStart, 0],
        [FIRST.revealStart + 180, 1],
        [FIRST.revealEnd - 220, 1],
        [FIRST.revealEnd, 0],
      ]),
      lit: keys(t, [
        [FIRST.ignitionStart, 0],
        [FIRST.ignitionStart + 150, 0.12],
        [1950, 1],
        [FIRST.ignitionEnd, 1],
      ]),
      // Pic au moment du grondement (le son atteint son maximum ≈ 0,55 s après son début).
      glow: keys(t, [
        [FIRST.ignitionStart, 0],
        [1950, 1],
        [FIRST.ignitionEnd + 150, 0.55],
        [FIRST.arrivalEnd, 0],
      ]),
      pulse: keys(t, [
        [FIRST.ignitionStart, 0],
        [1850, 0.22],
        [FIRST.ignitionEnd + 250, 0],
      ]),
      floor: keys(t, [
        [FIRST.ignitionStart, 0],
        [1900, 0.55],
        [FIRST.ignitionEnd + 450, 0],
      ]),
      veil: keys(t, [
        [0, 1],
        [FIRST.arrivalStart, 1],
        [FIRST.arrivalEnd, 0],
      ]),
      logoGlow: 0,
    };
  }
  const sweep = easeInOut(windowProgress(t, INSTANT.ignitionStart, INSTANT.ignitionEnd));
  return {
    dim: keys(t, [
      [0, 0.5],
      [INSTANT.contactEnd, 0.5],
      [INSTANT.ignitionEnd, 0.3],
      [INSTANT.powerOnEnd, 0],
    ]),
    dimAhead: 0,
    edge: 1.15 - 1.35 * sweep,
    band:
      t < INSTANT.ignitionStart || t > INSTANT.ignitionEnd
        ? 0
        : keys(t, [
            [INSTANT.ignitionStart, 0],
            [INSTANT.ignitionStart + 80, 1],
            [INSTANT.ignitionEnd - 100, 1],
            [INSTANT.ignitionEnd, 0],
          ]),
    lit: keys(t, [
      [INSTANT.ignitionStart, 0],
      [INSTANT.ignitionStart + 60, 0.12],
      [INSTANT.ignitionEnd + 150, 1],
    ]),
    // Pic à ≈ 0,55 s après le début du son, puis retour à l'intensité normale avant la fin.
    glow: keys(t, [
      [INSTANT.ignitionStart, 0],
      [800, 1],
      [INSTANT.powerOnEnd, 0.45],
      [INSTANT.end, 0],
    ]),
    pulse: keys(t, [
      [INSTANT.ignitionStart, 0],
      [550, 0.18],
      [900, 0],
    ]),
    floor: keys(t, [
      [INSTANT.ignitionStart, 0],
      [650, 0.4],
      [INSTANT.powerOnEnd, 0],
    ]),
    veil: keys(t, [
      [0, 0.5],
      [INSTANT.contactEnd, 0.5],
      [INSTANT.ignitionEnd, 0.3],
      [INSTANT.powerOnEnd, 0],
    ]),
    logoGlow: keys(t, [
      [INSTANT.ignitionStart, 0],
      [550, 1],
      [1000, 0],
    ]),
  };
}

/** Fenêtres d'apparition des éléments du dashboard, selon le scénario ; `start` = opacité de départ. */
export type RevealSlot =
  'logo' | 'name' | 'icon0' | 'icon1' | 'icon2' | 'greeting' | 'tabs' | 'card0' | 'card1' | 'card2';

export type RevealWindow = { from: number; to: number; start: number };

export function revealWindow(mode: OpeningMode, slot: RevealSlot): RevealWindow {
  'worklet';
  if (mode === 'first') {
    const a = FIRST.awakeningStart;
    switch (slot) {
      case 'logo':
        return { from: a, to: a + 380, start: 0 };
      case 'name':
        return { from: a + 80, to: a + 460, start: 0 };
      case 'icon0':
        return { from: a + 140, to: a + 520, start: 0 };
      case 'icon1':
        return { from: a + 200, to: a + 580, start: 0 };
      case 'icon2':
        return { from: a + 260, to: a + 640, start: 0 };
      case 'greeting':
        return { from: a + 260, to: a + 680, start: 0 };
      case 'tabs':
        return { from: a + 380, to: FIRST.end, start: 0 };
      case 'card0':
        return { from: a + 420, to: FIRST.end - 120, start: 0 };
      case 'card1':
        return { from: a + 480, to: FIRST.end - 60, start: 0 };
      case 'card2':
        return { from: a + 540, to: FIRST.end, start: 0 };
    }
  }
  switch (slot) {
    // Logo, nom et icônes sont déjà là : l'ouverture ne fait que les éclairer.
    case 'logo':
    case 'name':
    case 'icon0':
    case 'icon1':
    case 'icon2':
      return { from: 0, to: 1, start: 1 };
    case 'greeting':
      return { from: 300, to: 950, start: 0.35 };
    case 'tabs':
      return { from: 450, to: INSTANT.powerOnEnd, start: 0.35 };
    case 'card0':
      return { from: 1000, to: INSTANT.end - 80, start: 0.55 };
    case 'card1':
      return { from: 1060, to: INSTANT.end - 40, start: 0.55 };
    case 'card2':
      return { from: 1120, to: INSTANT.end, start: 0.55 };
  }
}

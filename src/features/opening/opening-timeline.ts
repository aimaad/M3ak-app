/**
 * Chronologie du scénario d'ouverture « Signature Ignition » (millisecondes, 2,0 s au total).
 * Une seule horloge (`openingTime`) pilote tous les éléments : chacun ne fait que lire « où en est l'ouverture » et en déduit
 * son opacité / sa position / sa progression de tracé. Fonctions pures, utilisables dans les animations (« worklet »).
 *
 *   1  Impulsion          0,0 – 0,3 s   la ligne émeraude se dessine du centre vers les extrémités
 *   2  Réveil du véhicule 0,3 – 0,7 s   la Mercedes apparaît de face, les phares s'allument, le moteur démarre
 *   3  Signature BIBIP    0,7 – 1,1 s   la lumière dessine le B du logo, une traînée prolonge vers le sol
 *   4  Mise en place      1,1 – 1,5 s   le logo se forme et rejoint le coin, la voiture passe en trois-quarts à droite
 *   5  Dashboard          1,5 – 2,0 s   le showroom apparaît, le message et les cartes arrivent
 */
export const SIG = {
  impulseEnd: 300,
  wakeEnd: 700,
  signatureEnd: 1100,
  placeEnd: 1500,
  end: 2000,
  /** Le moteur démarre un peu avant les phares : son pic (≈ 0,55 s après son début) tombe à leur pleine intensité. */
  soundAt: Math.round(700 - 550 / 1.75),
} as const;

/**
 * Ralentissement global : le storyboard est écrit sur 2,0 s, l'animation réelle dure 2,0 s × SLOW (3,5 s). Toutes les
 * phases gardent leurs proportions ; seule la vitesse de l'horloge change.
 */
export const SLOW = 1.75;
export const REAL_DURATION = SIG.end * SLOW;

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

export type StageCurves = {
  /** Scène 1 : avancement du tracé de la ligne (0 → 1, du centre vers les extrémités) et son opacité. */
  line: number;
  lineOpacity: number;
  /** Scène 2 : opacité de la voiture de face, fondu vers les phares allumés, reflet sur le sol. */
  front: number;
  lit: number;
  floor: number;
  /** Scène 3 : tracé du B (contour extérieur, puis courbe), sa lueur, son remplissage léger, la traînée. */
  trace1: number;
  trace2: number;
  bGlow: number;
  bFill: number;
  trail: number;
  trailOpacity: number;
  /** Scène 4 : logo (opacité, vol vers le coin, pastille), nom, passage de face → trois-quarts. */
  logo: number;
  logoFly: number;
  tile: number;
  wordmark: number;
  threeQuarter: number;
  threeQuarterMove: number;
  /** Fond sombre de l'introduction : sur le hero (le décor apparaît dès 1,35 s) et sous le hero (le dashboard, dès 1,5 s). */
  background: number;
  backgroundBelow: number;
};

/** Toutes les courbes de la scène d'introduction pour un instant donné. */
export function stageCurves(t: number): StageCurves {
  'worklet';
  const lit = keys(t, [
    [380, 0],
    [700, 1],
  ]);
  const frontFade = keys(t, [
    [1100, 1],
    [1400, 0],
  ]);
  return {
    line: easeOut(windowProgress(t, 0, SIG.impulseEnd)),
    lineOpacity: keys(t, [
      [0, 0],
      [200, 1],
      [1300, 0.9],
      [1600, 0],
    ]),
    // La voiture reste dans l'obscurité à son apparition (≈ 70 %), puis prend sa pleine présence derrière le B.
    front: keys(t, [
      [300, 0],
      [560, 0.7],
      [700, 0.85],
      [1000, 1],
      [1100, 1],
      [1400, 0],
    ]),
    lit,
    floor: lit * 0.55 * frontFade,
    trace1: easeInOut(windowProgress(t, 700, 1000)),
    trace2: easeInOut(windowProgress(t, 760, 1100)),
    bGlow: keys(t, [
      [700, 0],
      [900, 1],
      [1100, 1],
      [1400, 0],
    ]),
    bFill: keys(t, [
      [800, 0],
      [1100, 0.6],
      [1350, 0],
    ]),
    trail: easeInOut(windowProgress(t, 700, 1100)),
    trailOpacity: keys(t, [
      [700, 0],
      [800, 1],
      [1300, 0.85],
      [1600, 0],
    ]),
    logo:
      t >= SIG.placeEnd
        ? 0
        : keys(t, [
            [1000, 0],
            [1250, 1],
          ]),
    logoFly: easeInOut(windowProgress(t, 1100, SIG.placeEnd)),
    tile: keys(t, [
      [1350, 0],
      [1490, 1],
    ]),
    wordmark: keys(t, [
      [1100, 0],
      [1250, 1],
      [1400, 0],
    ]),
    threeQuarter: keys(t, [
      [1100, 0],
      [1350, 1],
    ]),
    threeQuarterMove: easeInOut(windowProgress(t, 1100, SIG.placeEnd)),
    background: keys(t, [
      [0, 1],
      [1350, 1],
      [1800, 0],
    ]),
    backgroundBelow: keys(t, [
      [0, 1],
      [1500, 1],
      [1850, 0],
    ]),
  };
}

/** Fenêtres d'apparition des éléments du dashboard (tous après l'arrivée du logo et de la voiture, 1,5 s). */
export type RevealSlot =
  'logo' | 'name' | 'icon0' | 'icon1' | 'icon2' | 'greeting' | 'tabs' | 'card0' | 'card1' | 'card2';

export type RevealWindow = { from: number; to: number; start: number };

export function revealWindow(slot: RevealSlot): RevealWindow {
  'worklet';
  const a = SIG.placeEnd;
  switch (slot) {
    // Le vrai logo prend la place du logo volant à l'instant exact de son arrivée.
    case 'logo':
      return { from: a, to: a + 30, start: 0 };
    case 'name':
      return { from: a, to: a + 250, start: 0 };
    case 'icon0':
      return { from: a, to: a + 300, start: 0 };
    case 'icon1':
      return { from: a + 50, to: a + 350, start: 0 };
    case 'icon2':
      return { from: a + 100, to: a + 400, start: 0 };
    case 'greeting':
      return { from: a + 50, to: a + 350, start: 0 };
    case 'tabs':
      return { from: a + 150, to: SIG.end, start: 0 };
    case 'card0':
      return { from: a + 100, to: a + 450, start: 0 };
    case 'card1':
      return { from: a + 150, to: a + 480, start: 0 };
    case 'card2':
      return { from: a + 200, to: SIG.end, start: 0 };
  }
}

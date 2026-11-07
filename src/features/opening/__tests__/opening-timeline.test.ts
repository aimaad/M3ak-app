import {
  DONE_TIME,
  easeInOut,
  easeOut,
  keys,
  REAL_DURATION,
  SLOW,
  revealWindow,
  SIG,
  stageCurves,
  windowProgress,
  type RevealSlot,
} from '../opening-timeline';

const SLOTS: RevealSlot[] = [
  'logo',
  'name',
  'icon0',
  'icon1',
  'icon2',
  'greeting',
  'tabs',
  'card0',
  'card1',
  'card2',
];

describe('Signature Ignition : chronologie', () => {
  it('dure 2,0 s en cinq phases qui s’enchaînent (0,3 / 0,7 / 1,1 / 1,5 / 2,0)', () => {
    expect([SIG.impulseEnd, SIG.wakeEnd, SIG.signatureEnd, SIG.placeEnd, SIG.end]).toEqual([
      300, 700, 1100, 1500, 2000,
    ]);
    expect(DONE_TIME).toBeGreaterThan(SIG.end);
  });

  it('l’animation réelle dure 3,5 s (2,0 s ralenties ×1,75)', () => {
    expect(REAL_DURATION).toBe(3500);
  });

  it('windowProgress borne entre 0 et 1', () => {
    expect(windowProgress(0, 100, 200)).toBe(0);
    expect(windowProgress(150, 100, 200)).toBeCloseTo(0.5);
    expect(windowProgress(900, 100, 200)).toBe(1);
    expect(windowProgress(150, 100, 100)).toBe(1);
  });

  it('les courbes de douceur partent de 0, arrivent à 1 et croissent', () => {
    for (const ease of [easeInOut, easeOut]) {
      expect(ease(0)).toBe(0);
      expect(ease(1)).toBe(1);
      let previous = -1;
      for (let i = 0; i <= 20; i++) {
        const value = ease(i / 20);
        expect(value).toBeGreaterThanOrEqual(previous);
        previous = value;
      }
    }
  });

  it('keys interpole entre les points et reste constant au-delà', () => {
    const points = [
      [100, 0],
      [200, 1],
    ] as const;
    expect(keys(0, points)).toBe(0);
    expect(keys(150, points)).toBeCloseTo(0.5);
    expect(keys(999, points)).toBe(1);
  });

  it('scène 1 : écran sombre, la ligne se dessine pendant 0,3 s', () => {
    const start = stageCurves(0);
    expect(start.line).toBe(0);
    expect(start.front).toBe(0);
    expect(start.background).toBe(1);
    expect(stageCurves(150).line).toBeGreaterThan(0.5);
    expect(stageCurves(300).line).toBe(1);
  });

  it('scène 2 : la voiture apparaît puis les phares s’allument après le départ du son', () => {
    // Le moteur démarre au moment où les phares commencent à s'allumer (380 ms de la chronologie).
    expect(Math.abs(SIG.soundAt - 380)).toBeLessThan(30);
    // Le pic du moteur (0,55 s après son début, en temps réel) tombe à la pleine intensité des phares (0,7 s de la chronologie).
    expect((700 - SIG.soundAt) * SLOW).toBeGreaterThan(500);
    expect((700 - SIG.soundAt) * SLOW).toBeLessThan(600);
    expect(stageCurves(300).front).toBe(0);
    expect(stageCurves(500).front).toBeGreaterThan(0.3);
    // La voiture reste dans l'obscurité à son apparition.
    expect(stageCurves(560).front).toBeLessThan(0.8);
    expect(stageCurves(379).lit).toBe(0);
    expect(stageCurves(700).lit).toBe(1);
    expect(stageCurves(700).floor).toBeGreaterThan(0.4);
  });

  it('scène 3 : le B se trace réellement (progression, pas une image terminée)', () => {
    expect(stageCurves(700).trace1).toBe(0);
    const mid = stageCurves(850);
    expect(mid.trace1).toBeGreaterThan(0.2);
    expect(mid.trace1).toBeLessThan(0.8);
    expect(stageCurves(1100).trace2).toBe(1);
  });

  it('scène 4 : le logo vole vers le coin et la voiture passe en trois-quarts', () => {
    expect(stageCurves(1100).logoFly).toBe(0);
    expect(stageCurves(1500).logoFly).toBe(1);
    expect(stageCurves(1100).threeQuarter).toBe(0);
    expect(stageCurves(1400).threeQuarter).toBe(1);
    expect(stageCurves(1400).front).toBe(0);
    // Le vrai logo prend le relais : un seul logo visible à l'arrivée.
    expect(stageCurves(1500).logo).toBe(0);
  });

  it('scène 5 : le fond se retire, plus aucun effet à la fin', () => {
    expect(stageCurves(1800).background).toBe(0);
    // Le dashboard (sous le hero) reste caché jusqu'à 1,5 s.
    expect(stageCurves(1400).backgroundBelow).toBe(1);
    expect(stageCurves(1850).backgroundBelow).toBe(0);
    const done = stageCurves(DONE_TIME);
    expect(done).toMatchObject({
      front: 0,
      floor: 0,
      bGlow: 0,
      trailOpacity: 0,
      lineOpacity: 0,
      logo: 0,
      background: 0,
    });
  });

  it('les éléments du dashboard n’apparaissent qu’après 1,5 s et finissent avant 2,0 s', () => {
    for (const slot of SLOTS) {
      const w = revealWindow(slot);
      expect(w.from).toBeGreaterThanOrEqual(SIG.placeEnd);
      expect(w.to).toBeLessThanOrEqual(SIG.end);
      expect(w.to).toBeGreaterThan(w.from);
    }
  });
});

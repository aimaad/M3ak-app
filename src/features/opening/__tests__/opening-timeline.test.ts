import {
  carCurves,
  DONE_TIME,
  durationOf,
  easeInOut,
  easeOut,
  FIRST,
  INSTANT,
  keys,
  revealWindow,
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

describe('opening-timeline', () => {
  it('les scénarios durent 3,8 s et 1,65 s et les phases s’enchaînent', () => {
    expect(durationOf('first')).toBe(3800);
    expect(durationOf('instant')).toBe(1650);
    expect(FIRST.revealStart).toBe(FIRST.darknessEnd);
    expect(FIRST.ignitionStart).toBe(FIRST.revealEnd);
    expect(FIRST.arrivalStart).toBe(FIRST.ignitionEnd);
    expect(FIRST.awakeningStart).toBe(FIRST.arrivalEnd);
    expect(INSTANT.ignitionStart).toBe(INSTANT.contactEnd);
    expect(DONE_TIME).toBeGreaterThan(FIRST.end);
  });

  it('le son démarre à l’allumage des phares', () => {
    expect(FIRST.soundAt).toBe(FIRST.ignitionStart);
    expect(INSTANT.soundAt).toBe(INSTANT.ignitionStart);
  });

  it('windowProgress borne entre 0 et 1', () => {
    expect(windowProgress(0, 100, 200)).toBe(0);
    expect(windowProgress(150, 100, 200)).toBeCloseTo(0.5);
    expect(windowProgress(900, 100, 200)).toBe(1);
    expect(windowProgress(50, 100, 100)).toBe(0);
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

  it('premier lancement : voiture quasi invisible au départ, effets éteints à la fin', () => {
    const start = carCurves('first', 0);
    // Tant que la lumière n'est pas passée, la voiture reste presque noire.
    expect(start.dimAhead).toBeGreaterThan(0.9);
    expect(start.edge).toBeGreaterThan(1);
    expect(start.lit).toBe(0);
    expect(start.glow).toBe(0);
    expect(start.veil).toBe(1);
    const done = carCurves('first', DONE_TIME);
    expect(done).toMatchObject({ dim: 0, lit: 1, glow: 0, pulse: 0, floor: 0, veil: 0, band: 0 });
  });

  it('premier lancement : les phares ne s’allument qu’après le départ du son', () => {
    expect(carCurves('first', FIRST.soundAt - 1).lit).toBe(0);
    expect(carCurves('first', FIRST.soundAt + 300).lit).toBeGreaterThan(0.1);
    expect(carCurves('first', FIRST.ignitionEnd).lit).toBe(1);
  });

  it('lancement suivant : retour à l’état normal à la fin', () => {
    const done = carCurves('instant', DONE_TIME);
    expect(done).toMatchObject({
      dim: 0,
      lit: 1,
      glow: 0,
      pulse: 0,
      floor: 0,
      veil: 0,
      logoGlow: 0,
    });
    expect(carCurves('instant', INSTANT.end)).toMatchObject({ glow: 0, floor: 0, veil: 0 });
    // Le dashboard reste lisible : le voile ne masque jamais complètement le hero.
    expect(carCurves('instant', 0).veil).toBeLessThanOrEqual(0.5);
  });

  it('le front de lumière traverse la voiture de la droite vers la gauche', () => {
    const a = carCurves('first', FIRST.revealStart).edge;
    const b = carCurves('first', (FIRST.revealStart + FIRST.revealEnd) / 2).edge;
    const c = carCurves('first', FIRST.revealEnd).edge;
    expect(a).toBeGreaterThan(1);
    expect(b).toBeLessThan(a);
    expect(c).toBeLessThan(0);
  });

  it('toutes les fenêtres d’apparition finissent avant la fin du scénario', () => {
    for (const mode of ['first', 'instant'] as const) {
      for (const slot of SLOTS) {
        const w = revealWindow(mode, slot);
        expect(w.to).toBeLessThanOrEqual(durationOf(mode));
        expect(w.to).toBeGreaterThan(w.from);
        expect(w.start).toBeGreaterThanOrEqual(0);
        expect(w.start).toBeLessThanOrEqual(1);
      }
    }
  });

  it('premier lancement : rien du dashboard n’apparaît avant le réveil', () => {
    for (const slot of SLOTS) {
      expect(revealWindow('first', slot).from).toBeGreaterThanOrEqual(FIRST.awakeningStart);
    }
  });
});

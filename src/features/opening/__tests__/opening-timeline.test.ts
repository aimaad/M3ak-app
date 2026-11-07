import {
  DONE_TIME,
  easeInOut,
  easeOut,
  ignitionCurves,
  IGN,
  windowProgress,
} from '../opening-timeline';

describe('ouverture : chronologie', () => {
  it('noir → allumage → moteur → application, dans cet ordre', () => {
    expect(IGN.darkInEnd).toBeLessThanOrEqual(IGN.litStart);
    expect(IGN.litStart).toBeLessThan(IGN.litEnd);
    // Le moteur se fait entendre APRÈS l'allumage complet.
    expect(IGN.soundAt).toBeGreaterThanOrEqual(IGN.litEnd);
    // Le noir ne se retire qu'une fois le moteur lancé.
    expect(IGN.fadeStart).toBeGreaterThan(IGN.soundAt);
    expect(IGN.end).toBeGreaterThan(IGN.fadeStart);
    expect(DONE_TIME).toBeGreaterThan(IGN.end);
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

  it('au départ : noir, voiture éteinte, silhouette qui émerge à peine', () => {
    const start = ignitionCurves(0);
    expect(start).toEqual({ dark: 0, lit: 0, stage: 1 });
    expect(ignitionCurves(300).dark).toBeGreaterThan(0.5);
    // Jusqu'à l'allumage, la voiture reste éteinte.
    expect(ignitionCurves(IGN.litStart).lit).toBe(0);
  });

  it('l’allumage est continu : croissant, sans palier ni retour en arrière', () => {
    let previous = -1;
    for (let t = IGN.litStart; t <= IGN.litEnd; t += 20) {
      const { lit } = ignitionCurves(t);
      expect(lit).toBeGreaterThanOrEqual(previous);
      previous = lit;
    }
    expect(ignitionCurves(IGN.litEnd).lit).toBe(1);
    // Pas de saut d'une image à l'autre (≈ 16 ms) : la variation reste faible.
    for (let t = IGN.litStart; t < IGN.litEnd; t += 16) {
      expect(ignitionCurves(t + 16).lit - ignitionCurves(t).lit).toBeLessThan(0.03);
    }
  });

  it('à la fin, l’introduction disparaît entièrement', () => {
    expect(ignitionCurves(IGN.fadeStart).stage).toBe(1);
    expect(ignitionCurves(IGN.end).stage).toBe(0);
    expect(ignitionCurves(DONE_TIME).stage).toBe(0);
  });
});

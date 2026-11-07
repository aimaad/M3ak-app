import {
  DONE_TIME,
  easeInOut,
  easeOut,
  ignitionCurves,
  IGN,
  SOUND_LATENCY,
  windowProgress,
} from '../opening-timeline';

describe('ouverture : chronologie', () => {
  it('noir → allumage → application, dans cet ordre', () => {
    expect(IGN.darkInEnd).toBeLessThanOrEqual(IGN.litStart);
    expect(IGN.litStart).toBeLessThan(IGN.litEnd);
    expect(IGN.fadeStart).toBeGreaterThan(IGN.litEnd);
    expect(IGN.end).toBeGreaterThan(IGN.fadeStart);
    expect(DONE_TIME).toBeGreaterThan(IGN.end);
  });

  it('les phares s’allument d’un seul coup, comme une vraie voiture (≤ 80 ms)', () => {
    expect(IGN.litEnd - IGN.litStart).toBeLessThanOrEqual(80);
  });

  it('le moteur démarre exactement à l’allumage (à la latence audio près)', () => {
    expect(IGN.soundAt).toBe(IGN.litStart - SOUND_LATENCY);
    expect(Math.abs(IGN.soundAt - IGN.litStart)).toBeLessThanOrEqual(100);
    // Le son (1,04 s) est terminé ou presque quand le noir se retire.
    expect(IGN.soundAt + 1040).toBeLessThanOrEqual(IGN.fadeStart + 600);
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

  it('l’allumage est monotone : croissant, sans retour en arrière ni dépassement', () => {
    let previous = -1;
    for (let t = IGN.litStart - 20; t <= IGN.litEnd + 20; t += 5) {
      const { lit } = ignitionCurves(t);
      expect(lit).toBeGreaterThanOrEqual(previous);
      expect(lit).toBeLessThanOrEqual(1);
      previous = lit;
    }
    expect(ignitionCurves(IGN.litEnd).lit).toBe(1);
  });

  it('à la fin, l’introduction disparaît entièrement', () => {
    expect(ignitionCurves(IGN.fadeStart).stage).toBe(1);
    expect(ignitionCurves(IGN.end).stage).toBe(0);
    expect(ignitionCurves(DONE_TIME).stage).toBe(0);
  });
});

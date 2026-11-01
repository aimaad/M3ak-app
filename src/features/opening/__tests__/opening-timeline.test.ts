import {
  easeInOut,
  easeOut,
  flightControl,
  OPENING_PHASES,
  quadraticPoint,
  windowProgress,
} from '../opening-timeline';

describe('opening-timeline', () => {
  it('les phases s’enchaînent sans trou et durent 4,3 s', () => {
    const p = OPENING_PHASES;
    expect(p.sweepStart).toBe(p.darknessEnd);
    expect(p.headlightsStart).toBe(p.sweepEnd);
    expect(p.emergenceStart).toBe(p.headlightsEnd);
    expect(p.awakeningStart).toBe(p.flightEnd);
    expect(p.end).toBe(4300);
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

  it('la trajectoire du logo relie départ et arrivée', () => {
    const start = { x: 200, y: 300 };
    const end = { x: 20, y: 40 };
    const control = flightControl(start, end);
    expect(quadraticPoint(start, control, end, 0)).toEqual(start);
    const last = quadraticPoint(start, control, end, 1);
    expect(last.x).toBeCloseTo(end.x);
    expect(last.y).toBeCloseTo(end.y);
    // Pas de rebond : la distance à l'arrivée ne fait que diminuer.
    let previous = Infinity;
    for (let i = 0; i <= 20; i++) {
      const point = quadraticPoint(start, control, end, i / 20);
      const distance = Math.hypot(point.x - end.x, point.y - end.y);
      expect(distance).toBeLessThanOrEqual(previous + 1e-9);
      previous = distance;
    }
  });
});

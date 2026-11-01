import {
  angleAt,
  centerIndex,
  frameOpacity,
  framePosition,
  isShowroomAvailable,
  mountedRange,
  shouldRunShowroom,
  swing,
  SHOWROOM,
} from '../showroom-math';

describe('swing (aller-retour lissé)', () => {
  it('commence au centre, atteint +8° au quart, revient au centre, atteint −8° aux trois quarts', () => {
    const T = SHOWROOM.periodMs;
    expect(swing(0)).toBeCloseTo(0.5);
    expect(swing(T / 4)).toBeCloseTo(1);
    expect(swing(T / 2)).toBeCloseTo(0.5);
    expect(swing((3 * T) / 4)).toBeCloseTo(0);
    expect(swing(T)).toBeCloseTo(0.5);
  });

  it('reste toujours entre 0 et 1 et se répète à l’identique', () => {
    for (let t = 0; t < 30000; t += 137) {
      const value = swing(t);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
      expect(swing(t + SHOWROOM.periodMs)).toBeCloseTo(value);
    }
  });

  it('ralentit aux extrémités (pas de coup sec au retour)', () => {
    const T = SHOWROOM.periodMs;
    const nearEnd = Math.abs(swing(T / 4 + 20) - swing(T / 4));
    const nearCenter = Math.abs(swing(20) - swing(0));
    expect(nearEnd).toBeLessThan(nearCenter / 10);
  });

  it('gère un temps négatif sans sortir de la plage', () => {
    expect(swing(-1000)).toBeGreaterThanOrEqual(0);
    expect(swing(-1000)).toBeLessThanOrEqual(1);
  });
});

describe('angle et position dans la séquence', () => {
  it('va de −8° à +8°, jamais plus', () => {
    expect(angleAt(0)).toBe(-8);
    expect(angleAt(0.5)).toBe(0);
    expect(angleAt(1)).toBe(8);
    expect(angleAt(-3)).toBe(-8);
    expect(angleAt(9)).toBe(8);
  });

  it('place la position fractionnaire entre la première et la dernière image', () => {
    expect(framePosition(0, 25)).toBe(0);
    expect(framePosition(1, 25)).toBe(24);
    expect(framePosition(0.5, 25)).toBe(12);
    expect(framePosition(2, 25)).toBe(24);
    expect(framePosition(0.5, 0)).toBe(0);
  });
});

describe('frameOpacity (fondu entre deux images)', () => {
  it('image du dessous pleine, image du dessus progressive, les autres invisibles', () => {
    expect(frameOpacity(4, 4.25)).toBe(1);
    expect(frameOpacity(5, 4.25)).toBeCloseTo(0.25);
    expect(frameOpacity(3, 4.25)).toBe(0);
    expect(frameOpacity(6, 4.25)).toBe(0);
  });

  it('sur une position entière, une seule image est visible', () => {
    const visible = Array.from({ length: 9 }, (_, i) => frameOpacity(i, 4)).filter((v) => v > 0);
    expect(visible).toEqual([1]);
  });

  it('à tout moment, exactement une image pleine et au plus une autre partielle', () => {
    for (let f = 0; f <= 24; f += 0.1) {
      const opacities = Array.from({ length: 25 }, (_, i) => frameOpacity(i, f));
      expect(opacities.filter((v) => v === 1)).toHaveLength(1);
      expect(opacities.filter((v) => v > 0 && v < 1).length).toBeLessThanOrEqual(1);
    }
  });
});

describe('mountedRange (mémoire bornée)', () => {
  it('garde peu d’images montées autour de la position courante', () => {
    expect(mountedRange(12.4, 25)).toEqual([10, 15]);
    const [from, to] = mountedRange(12.4, 25);
    expect(to - from + 1).toBeLessThanOrEqual(2 * SHOWROOM.mountRadius + 2);
  });

  it('reste dans les bornes aux extrémités', () => {
    expect(mountedRange(0, 25)).toEqual([0, 3]);
    expect(mountedRange(24, 25)).toEqual([22, 24]);
  });
});

describe('disponibilité et conditions de lecture', () => {
  it('centerIndex : image du milieu (0°)', () => {
    expect(centerIndex(25)).toBe(12);
    expect(centerIndex(1)).toBe(0);
    expect(centerIndex(0)).toBe(0);
  });

  it('inactive sans fond sans voiture ou avec une séquence trop courte', () => {
    expect(isShowroomAvailable(0, false)).toBe(false);
    expect(isShowroomAvailable(25, false)).toBe(false);
    expect(isShowroomAvailable(5, true)).toBe(false);
    expect(isShowroomAvailable(25, true)).toBe(true);
  });

  it('ne tourne que si tout est réuni, et s’arrête dès qu’une condition tombe', () => {
    const ok = { focused: true, appActive: true, heroVisible: true, reduceMotion: false, loaded: true };
    expect(shouldRunShowroom(ok)).toBe(true);
    expect(shouldRunShowroom({ ...ok, focused: false })).toBe(false);
    expect(shouldRunShowroom({ ...ok, appActive: false })).toBe(false);
    expect(shouldRunShowroom({ ...ok, heroVisible: false })).toBe(false);
    expect(shouldRunShowroom({ ...ok, reduceMotion: true })).toBe(false);
    expect(shouldRunShowroom({ ...ok, loaded: false })).toBe(false);
  });
});

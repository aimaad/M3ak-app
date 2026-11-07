import { carRect, CAR_IMAGE_SIZE, showroomLayout, SHOWROOM_IMAGE_SIZE } from '../hero-layout';

const SIZES = [
  { width: 320, height: 300 },
  { width: 390, height: 330 },
  { width: 430, height: 340 },
  { width: 768, height: 360 },
];

describe('hero-layout', () => {
  it('le showroom couvre toujours tout le hero, sans déformation', () => {
    for (const { width, height } of SIZES) {
      const r = showroomLayout(width, height);
      expect(r.left).toBeLessThanOrEqual(0.01);
      expect(r.left + r.width).toBeGreaterThanOrEqual(width - 0.01);
      expect(r.top).toBeLessThanOrEqual(0.01);
      expect(r.top + r.height).toBeGreaterThanOrEqual(height - 0.01);
      expect(r.width / r.height).toBeCloseTo(SHOWROOM_IMAGE_SIZE.width / SHOWROOM_IMAGE_SIZE.height, 5);
    }
  });

  it('la voiture garde ses proportions et reste dans le hero, à droite', () => {
    for (const { width, height } of SIZES) {
      const r = carRect(width, height);
      expect(r.width / r.height).toBeCloseTo(CAR_IMAGE_SIZE.width / CAR_IMAGE_SIZE.height, 5);
      expect(r.left).toBeGreaterThan(width * 0.3);
      expect(r.left + r.width).toBeLessThanOrEqual(width);
      expect(r.top).toBeGreaterThanOrEqual(0);
      expect(r.top + r.height).toBeLessThanOrEqual(height);
    }
  });

  it('la voiture ne devient jamais gigantesque sur tablette', () => {
    expect(carRect(768, 360).width).toBeLessThanOrEqual(300);
    expect(carRect(1024, 400).width).toBeLessThanOrEqual(300);
  });
});

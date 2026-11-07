import { carRect, CAR_IMAGE_SIZE } from '@/features/dashboard/hero-layout';

import { LOGO_PATHS, LOGO_VIEWBOX } from '../logo-path';
import { FRONT_IMAGE_SIZE, signatureGeometry } from '../signature-layout';

const SCREENS = [
  { width: 320, height: 640 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
];

describe('signatureGeometry', () => {
  it('la voiture de face est centrée, garde ses proportions et reste dans l’écran', () => {
    for (const { width, height } of SCREENS) {
      const g = signatureGeometry(width, height, 330);
      expect(g.front.left + g.front.width / 2).toBeCloseTo(width / 2);
      expect(g.front.width / g.front.height).toBeCloseTo(
        FRONT_IMAGE_SIZE.width / FRONT_IMAGE_SIZE.height,
        5
      );
      expect(g.front.left).toBeGreaterThanOrEqual(0);
      expect(g.front.top).toBeGreaterThan(0);
      expect(g.front.top + g.front.height).toBeLessThanOrEqual(height);
    }
  });

  it('le B garde les proportions exactes du logo et se place derrière la voiture', () => {
    for (const { width, height } of SCREENS) {
      const g = signatureGeometry(width, height, 330);
      expect(g.logo.width / g.logo.height).toBeCloseTo(LOGO_VIEWBOX.width / LOGO_VIEWBOX.height, 5);
      expect(g.logo.top).toBeLessThan(g.front.top);
    }
  });

  it('la voiture en trois-quarts finit exactement à sa place dans le hero', () => {
    const g = signatureGeometry(390, 844, 330);
    expect(g.three.end).toEqual(carRect(390, 330));
    expect(g.three.start.width / g.three.start.height).toBeCloseTo(
      CAR_IMAGE_SIZE.width / CAR_IMAGE_SIZE.height,
      5
    );
  });

  it('les tracés ont une longueur utilisable pour l’animation', () => {
    const g = signatureGeometry(390, 844, 330);
    expect(g.line.left.length).toBeGreaterThan(100);
    expect(g.trail.length).toBeGreaterThan(g.line.left.length);
  });
});

describe('tracé du logo', () => {
  it('provient du logo fourni : deux contours fermés, longueurs cohérentes', () => {
    expect(LOGO_PATHS.length).toBe(2);
    for (const path of LOGO_PATHS) {
      expect(path.d.startsWith('M')).toBe(true);
      expect(path.d.endsWith('Z')).toBe(true);
      expect(path.length).toBeGreaterThan(500);
    }
  });
});

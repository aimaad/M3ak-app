import { IGNITION_IMAGE, ignitionLayout } from '../ignition-layout';

const SCREENS = [
  { width: 320, height: 640 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
];

describe('ignitionLayout', () => {
  it('garde les proportions de la photo (aucune déformation)', () => {
    for (const { width, height } of SCREENS) {
      const { frame } = ignitionLayout(width, height);
      expect(frame.width / frame.height).toBeCloseTo(
        IGNITION_IMAGE.width / IGNITION_IMAGE.height,
        5
      );
    }
  });

  it('la voiture occupe la largeur de l’écran et reste dans l’écran, au centre', () => {
    for (const { width, height } of SCREENS) {
      const { frame } = ignitionLayout(width, height);
      // Le centre de la photo (la voiture) est au centre horizontal de l'écran, à une marge près (partie utile symétrique ± 15 px).
      const carCenter = frame.left + (frame.width / IGNITION_IMAGE.width) * (1671 / 2);
      expect(Math.abs(carCenter - width / 2)).toBeLessThan(width * 0.05);
      expect(frame.top).toBeGreaterThan(0);
      expect(frame.top + frame.height).toBeLessThan(height);
    }
  });

  it('le haut et le bas de la photo sont fondus dans le noir', () => {
    const { frame, topFade, bottomFade } = ignitionLayout(390, 844);
    expect(topFade.top).toBeLessThanOrEqual(frame.top);
    expect(bottomFade.top + bottomFade.height).toBeGreaterThanOrEqual(frame.top + frame.height);
  });
});

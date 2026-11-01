import { CAR_IN_IMAGE, heroImageLayout, HERO_IMAGE_SIZE, imagePointToHero } from '../hero-layout';

describe('heroImageLayout', () => {
  it('la voiture occupe la fraction demandée de la largeur, calée à droite', () => {
    const layout = heroImageLayout(390, 313);
    const carWidth = (CAR_IN_IMAGE.right - CAR_IN_IMAGE.left) * layout.scale;
    expect(carWidth).toBeCloseTo(0.58 * 390);
    expect(layout.left + CAR_IN_IMAGE.right * layout.scale).toBeCloseTo(390 - 10);
  });

  it('le bas des roues est au-dessus du bas du hero (place du sélecteur)', () => {
    const layout = heroImageLayout(390, 313);
    expect(layout.top + CAR_IN_IMAGE.wheelsBottom * layout.scale).toBeCloseTo(313 - 96);
  });

  it('garde les proportions de l’image sur tous les écrans', () => {
    for (const width of [320, 360, 390, 430, 768]) {
      const layout = heroImageLayout(width, 300);
      expect(layout.width / layout.height).toBeCloseTo(
        HERO_IMAGE_SIZE.width / HERO_IMAGE_SIZE.height
      );
    }
  });

  it('un petit écran garde la voiture entière dans le hero', () => {
    const layout = heroImageLayout(320, 290);
    expect(layout.left + CAR_IN_IMAGE.left * layout.scale).toBeGreaterThan(0);
    expect(layout.left + CAR_IN_IMAGE.right * layout.scale).toBeLessThanOrEqual(320);
  });
});

describe('imagePointToHero', () => {
  it('convertit un point de l’image en point du hero', () => {
    const layout = heroImageLayout(390, 313);
    const point = imagePointToHero(layout, 455, 326);
    expect(point.x).toBeCloseTo(layout.left + 455 * layout.scale);
    expect(point.y).toBeCloseTo(layout.top + 326 * layout.scale);
  });
});

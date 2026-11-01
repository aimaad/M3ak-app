import { isBoxValid, isTurntableAvailable, turntableLayout } from '../turntable-math';
import { TURNTABLE_BOX } from '../turntable-assets';

describe('turntableLayout', () => {
  it('place la vidéo dans le cadre de la photo', () => {
    const layout = turntableLayout(1000, 1094, { x: 0.18, y: 0.28, w: 0.82, h: 0.5 });
    expect(layout.left).toBeCloseTo(180);
    expect(layout.top).toBeCloseTo(306.32);
    expect(layout.width).toBeCloseTo(820);
    expect(layout.height).toBeCloseTo(547);
  });
});

describe('isTurntableAvailable', () => {
  it('inactive sans fichier vidéo', () => {
    expect(isTurntableAvailable(null)).toBe(false);
    expect(isTurntableAvailable(12)).toBe(true);
    expect(isTurntableAvailable('/assets/car-turntable.mp4')).toBe(true);
    expect(isTurntableAvailable({ uri: 'x.mp4' })).toBe(true);
    expect(isTurntableAvailable(undefined)).toBe(false);
  });
});

describe('isBoxValid', () => {
  it('la zone par défaut tient dans la photo et a les proportions de la vidéo 720 × 480', () => {
    expect(isBoxValid(TURNTABLE_BOX, 1000, 1094, 720, 480)).toBe(true);
  });
  it('refuse une zone qui déborde ou dont les proportions étireraient la vidéo', () => {
    expect(isBoxValid({ x: 0.5, y: 0.28, w: 0.82, h: 0.5 }, 1000, 1094, 720, 480)).toBe(false);
    expect(isBoxValid(TURNTABLE_BOX, 1000, 1094, 1280, 480)).toBe(false);
  });
});

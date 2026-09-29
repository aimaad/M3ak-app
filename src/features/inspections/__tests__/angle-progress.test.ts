import { computeAngleProgress } from '../angle-progress';
import { CAPTURE_ANGLES } from '../types';

describe('computeAngleProgress', () => {
  it("indique le premier angle du guide quand rien n'est capturé", () => {
    const progress = computeAngleProgress([]);
    expect(progress.nextAngle).toBe(CAPTURE_ANGLES[0]);
    expect(progress.isComplete).toBe(false);
    expect(progress.capturedAngles).toEqual([]);
  });

  it('respecte l\'ordre du guide, pas l\'ordre de capture', () => {
    const progress = computeAngleProgress(['lateral_droit', 'avant']);
    expect(progress.capturedAngles).toEqual(['avant', 'lateral_droit']);
  });

  it('propose le prochain angle manquant', () => {
    const progress = computeAngleProgress(['avant', 'arriere']);
    expect(progress.nextAngle).toBe('lateral_gauche');
  });

  it('est complet quand tous les angles du guide sont couverts', () => {
    const progress = computeAngleProgress(CAPTURE_ANGLES);
    expect(progress.isComplete).toBe(true);
    expect(progress.nextAngle).toBeNull();
  });

  it('ignore les angles hors guide (ex. autre, interieur)', () => {
    const progress = computeAngleProgress(['autre', 'interieur']);
    expect(progress.capturedAngles).toEqual([]);
    expect(progress.nextAngle).toBe(CAPTURE_ANGLES[0]);
  });
});

import { computeAngleProgress } from '../angle-progress';
import { CAPTURE_ANGLES, isSkippableAngle } from '../types';

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
    expect(progress.nextAngle).toBe('avant_gauche');
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

describe('guide de capture complet', () => {
  it("couvre l'extérieur, les roues et l'intérieur (sièges, frein à main, plafond…)", () => {
    for (const angle of ['capot', 'toit', 'jante_avant_gauche', 'siege_avant_gauche', 'banquette_arriere', 'frein_a_main', 'plafond', 'tapis', 'coffre_interieur', 'tableau_de_bord'] as const) {
      expect(CAPTURE_ANGLES).toContain(angle);
    }
    expect(new Set(CAPTURE_ANGLES).size).toBe(CAPTURE_ANGLES.length);
  });

  it("n'autorise à ignorer que certains angles de l'intérieur", () => {
    expect(isSkippableAngle('banquette_arriere')).toBe(true);
    expect(isSkippableAngle('tableau_de_bord')).toBe(false);
    expect(isSkippableAngle('avant')).toBe(false);
    expect(isSkippableAngle('jante_avant_droit')).toBe(false);
  });
});

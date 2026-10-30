import { fixPlateDirection } from '../plate';

describe('fixPlateDirection', () => {
  it('entoure la lettre arabe d’une plaque marocaine', () => {
    expect(fixPlateDirection('8921-أ-14')).toBe('8921-‎أ‎-14');
    expect(fixPlateDirection('8921 | ب | 14')).toBe('8921 | ‎ب‎ | 14');
  });
  it('fonctionne au milieu d’un texte', () => {
    expect(fixPlateDirection('Dacia Logan · 8921-أ-14')).toBe('Dacia Logan · 8921-‎أ‎-14');
  });
  it('ne touche pas aux autres textes', () => {
    for (const text of ['Dacia Logan', 'مرحباً بك في M3ak', '12 octobre 2026', 'LOC-2026-00012', '1-A-1', 'شكون كرا هاد الطوموبيل؟']) {
      expect(fixPlateDirection(text)).toBe(text);
    }
  });
});

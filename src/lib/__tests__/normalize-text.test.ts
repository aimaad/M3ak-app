import { normalizeText } from '../normalize-text';

describe('normalizeText', () => {
  it('remplace l\'espace fine insécable des nombres français par une espace insécable ordinaire', () => {
    expect((1234567).toLocaleString('fr-FR')).toContain(' ');
    expect(normalizeText((1234567).toLocaleString('fr-FR'))).toBe('1 234 567');
  });

  it('traite aussi les enfants multiples (texte + valeur)', () => {
    expect(normalizeText(['Total : ', '2 200', ' MAD'])).toEqual(['Total : ', '2 200', ' MAD']);
  });

  it('laisse intacts les nombres, null et les éléments', () => {
    expect(normalizeText(42)).toBe(42);
    expect(normalizeText(null)).toBeNull();
  });
});

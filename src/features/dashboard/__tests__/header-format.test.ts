import { badgeLabel, headerFirstName } from '../header-format';

describe('headerFirstName', () => {
  it('préfère le prénom du profil', () => {
    expect(headerFirstName(' Imad ', 'Imad Amada')).toBe('Imad');
  });
  it('retombe sur le premier mot du nom complet', () => {
    expect(headerFirstName(null, 'Sara  El Idrissi')).toBe('Sara');
  });
  it('renvoie une chaîne vide sans donnée', () => {
    expect(headerFirstName(undefined, null)).toBe('');
    expect(headerFirstName('  ', '  ')).toBe('');
  });
});

describe('badgeLabel', () => {
  it('masque le zéro, plafonne à 99+', () => {
    expect(badgeLabel(0)).toBeNull();
    expect(badgeLabel(7)).toBe('7');
    expect(badgeLabel(100)).toBe('99+');
  });
});

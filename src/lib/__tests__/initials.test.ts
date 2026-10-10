import { getInitials } from '../initials';

describe('getInitials', () => {
  it('retourne "?" sans nom', () => {
    expect(getInitials(null)).toBe('?');
    expect(getInitials(undefined)).toBe('?');
    expect(getInitials('')).toBe('?');
  });

  it('retourne les 2 premières lettres pour un seul mot', () => {
    expect(getInitials('Karim')).toBe('KA');
  });

  it('retourne la première lettre de chaque extrémité pour un nom complet', () => {
    expect(getInitials('Karim Alaoui')).toBe('KA');
    expect(getInitials('Fatima Zahra Idrissi')).toBe('FI');
  });

  it('ignore les espaces en trop', () => {
    expect(getInitials('  Karim   Alaoui  ')).toBe('KA');
  });
});

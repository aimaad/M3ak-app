import { buildCsv, csvCell } from '../csv';

describe('csvCell', () => {
  it('laisse un texte simple tel quel', () => expect(csvCell('Karim')).toBe('Karim'));
  it('met entre guillemets le séparateur, les guillemets et les sauts de ligne', () => {
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('dit "oui"')).toBe('"dit ""oui"""');
    expect(csvCell('l1\nl2')).toBe('"l1\nl2"');
  });
  it('neutralise les formules Excel mais garde les nombres négatifs', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('@cmd')).toBe("'@cmd");
    expect(csvCell('-12,5')).toBe('-12,5');
    expect(csvCell('+212661000001')).toBe('+212661000001');
  });
  it('gère null et undefined', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });
});

describe('buildCsv', () => {
  it('ajoute le BOM et sépare par « ; » avec fin de ligne Windows', () => {
    expect(buildCsv(['Nom', 'Ville'], [['Karim', 'Casa'], ['Sara', 'Rabat']])).toBe('﻿Nom;Ville\r\nKarim;Casa\r\nSara;Rabat\r\n');
  });
});

/* eslint-disable import/first -- le « jest.mock » doit précéder les imports */
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));

import { suggestDailyPrice } from '../../pricing-suggestion';
import type { Vehicle } from '../../types';
import { deadlineDocuments, essentialProgress, formatDateInput, formatThousands, isValidDeadline, statusForRentable, stepPrice, suggestCategory } from '../finalize';

describe('avancement des infos essentielles', () => {
  const base = { showPrice: true, price: '', km: '', hasPhoto: false };

  it('0/3 au départ, la carte du prix est la première à remplir', () => {
    expect(essentialProgress(base)).toMatchObject({ done: 0, total: 3, next: 'price' });
  });

  it('chaque info remplie compte ; la suivante est mise en avant', () => {
    expect(essentialProgress({ ...base, price: '400' })).toMatchObject({ done: 1, total: 3, next: 'km' });
    expect(essentialProgress({ ...base, price: '400', km: '45 000' })).toMatchObject({ done: 2, next: 'photo' });
    expect(essentialProgress({ ...base, price: '400', km: '0', hasPhoto: true })).toMatchObject({ done: 3, next: null }); // 0 km est une valeur
  });

  it('un prix à 0 ou vide ne compte pas', () => {
    expect(essentialProgress({ ...base, price: '0' }).items[0].done).toBe(false);
    expect(essentialProgress({ ...base, price: '' }).items[0].done).toBe(false);
  });

  it('l’employé ne voit pas le prix : 2 infos essentielles seulement, aucune carte prix', () => {
    const progress = essentialProgress({ ...base, showPrice: false, km: '12000' });
    expect(progress.items.map((item) => item.key)).toEqual(['km', 'photo']);
    expect(progress).toMatchObject({ done: 1, total: 2, next: 'photo' });
  });
});

describe('prix par jour : boutons − et +', () => {
  it('par pas de 50 ; sans prix, + part de 300 et − de 250 ; jamais sous 0', () => {
    expect(stepPrice(400, 1)).toBe(450);
    expect(stepPrice(400, -1)).toBe(350);
    expect(stepPrice(0, 1)).toBe(300);
    expect(stepPrice(0, -1)).toBe(250);
    expect(stepPrice(50, -1)).toBe(0);
    expect(stepPrice(20, -1)).toBe(0);
  });

  it('kilométrage : séparateur de milliers, seuls les chiffres comptent', () => {
    expect(formatThousands('45000')).toBe('45 000');
    expect(formatThousands('1234567')).toBe('1 234 567');
    expect(formatThousands('4 5a000')).toBe('45 000');
    expect(formatThousands('007')).toBe('7');
    expect(formatThousands('')).toBe('');
    expect(formatThousands('0')).toBe('0');
  });
});

describe('prix habituel de la catégorie (médiane des autres véhicules)', () => {
  const v = (id: string, categorie: Vehicle['categorie'], prixJour: number, archivedAt: string | null = null) => ({ id, categorie, prixJour, archivedAt }) as Vehicle;
  it('médiane des véhicules de la catégorie, archivés et prix à 0 exclus', () => {
    const fleet = [v('a', 'suv', 400), v('b', 'suv', 500), v('c', 'suv', 900), v('d', 'suv', 100, '2030-01-01T00:00:00Z'), v('e', 'suv', 0), v('f', 'berline', 300)];
    expect(suggestDailyPrice(fleet, 'suv')).toBe(500);
    expect(suggestDailyPrice([v('a', 'suv', 400), v('b', 'suv', 500)], 'suv')).toBe(450);
  });
  it('aucun autre véhicule de la catégorie (ou catégorie non choisie) : pas de suggestion', () => {
    expect(suggestDailyPrice([v('f', 'berline', 300)], 'suv')).toBeNull();
    expect(suggestDailyPrice([], 'suv')).toBeNull();
    expect(suggestDailyPrice([v('a', 'suv', 400)], null)).toBeNull();
  });
});

describe('statut « Louable tout de suite »', () => {
  it('activé = Disponible, désactivé = En préparation', () => {
    expect(statusForRentable(true)).toBe('disponible');
    expect(statusForRentable(false)).toBe('en_preparation');
  });
});

describe('catégorie pré-choisie', () => {
  it('d’après le genre de la carte grise, plus sûr que le nom du modèle', () => {
    expect(suggestCategory({ genre: 'Camionnette', modele: 'Duster' })).toBe('utilitaire');
    expect(suggestCategory({ genre: 'Autocar', modele: 'Sprinter' })).toBe('minibus');
  });
  it('d’après le modèle', () => {
    expect(suggestCategory({ genre: 'Voiture particulière', marque: 'Dacia', modele: 'Sandero Stepway' })).toBe('suv');
    expect(suggestCategory({ marque: 'Dacia', modele: 'Duster' })).toBe('suv');
    expect(suggestCategory({ marque: 'Dacia', modele: 'Logan' })).toBe('berline');
    expect(suggestCategory({ marque: 'Peugeot', modele: '208' })).toBe('compacte');
    expect(suggestCategory({ marque: 'Renault', modele: 'Clio 5' })).toBe('compacte');
    expect(suggestCategory({ marque: 'Renault', modele: 'Kangoo' })).toBe('utilitaire');
  });
  it('sans indice : rien n’est choisi', () => {
    expect(suggestCategory({ genre: 'Voiture particulière', marque: 'Marque inconnue', modele: 'XYZ' })).toBeNull();
    expect(suggestCategory({})).toBeNull();
  });
});

describe('échéances (assurance, visite technique)', () => {
  it('saisie au fil de la frappe', () => {
    expect(formatDateInput('1')).toBe('1');
    expect(formatDateInput('150')).toBe('15/0');
    expect(formatDateInput('15062031')).toBe('15/06/2031');
    expect(formatDateInput('15/06/2031 99')).toBe('15/06/2031');
  });
  it('date valable : jour réel, année plausible ; une date passée est permise', () => {
    expect(isValidDeadline('15/06/2031')).toBe(true);
    expect(isValidDeadline('15/06/2020')).toBe(true);
    expect(isValidDeadline('31/02/2031')).toBe(false);
    expect(isValidDeadline('15/06/1999')).toBe(false);
    expect(isValidDeadline('')).toBe(false);
  });
  it('document sans fichier (chemin vide) avec la date ; les dates vides sont ignorées', () => {
    const now = new Date('2030-06-10T10:00:00Z');
    expect(deadlineDocuments({ assurance: '15/06/2031', visite_technique: '' }, now)).toEqual([{ type: 'assurance', path: '', uploadedAt: '2030-06-10T10:00:00.000Z', expiresAt: '2031-06-15' }]);
    expect(deadlineDocuments({}, now)).toEqual([]);
    expect(deadlineDocuments({ visite_technique: '31/02/2031' }, now)).toEqual([]);
  });
});

import type { Vehicle } from '../../types';
import { duplicatePlateGroups, findExistingVehicle, rentalCount } from '../lookup';
import { extractVin, formatPlate, isValidVin, joinPlate, joinWw, plateKey, plateKind, splitPlate, vinKey } from '../plate';
import { parseRecentChecks, pushRecentCheck, RECENT_CHECKS_MAX, type RecentCheck } from '../recent-checks';

const v = (id: string, immatriculation: string, extra: Partial<Vehicle> = {}) => ({ id, immatriculation, vin: null, archivedAt: null, ...extra }) as Vehicle;

describe('plaque marocaine, WW et autres', () => {
  it('reconnaît le type de plaque', () => {
    expect(plateKind('68013 | ب | 72')).toBe('moroccan');
    expect(plateKind('68013-ب-72')).toBe('moroccan');
    expect(plateKind('ww 482190')).toBe('ww');
    expect(plateKind('WW-482190')).toBe('ww');
    expect(plateKind('AB 123')).toBe('other');
  });

  it('forme enregistrée : « numéro | lettre | région » ; WW avec une espace ; le reste nettoyé', () => {
    expect(formatPlate('68013-ب-72')).toBe('68013 | ب | 72');
    expect(formatPlate('  8921 / ب / 14 ')).toBe('8921 | ب | 14');
    expect(formatPlate('8921 ب 14')).toBe('8921 | ب | 14');
    expect(formatPlate('ww482190')).toBe('WW 482190');
    expect(formatPlate('  ab   123 ')).toBe('AB 123');
  });

  it('la lettre « هـ » (allongée) et « ه » sont la même plaque ; les marques invisibles ne comptent pas', () => {
    expect(formatPlate('1234 | هـ | 5')).toBe('1234 | ه | 5');
    expect(plateKey('1234 | هـ | 5')).toBe(plateKey('1234-ه-5'));
    expect(plateKey('‎8921‎-ب-14')).toBe(plateKey('8921 | ب | 14'));
    expect(formatPlate('1234-إ-5')).toBe('1234 | أ | 5');
  });

  it('la forme enregistrée ne change jamais la comparaison et est stable (idempotente)', () => {
    for (const raw of ['68013-ب-72', '8921 | ب | 14', 'ww 482190', 'WW-12', 'ab 123', '1234 هـ 5']) {
      expect(plateKey(formatPlate(raw))).toBe(plateKey(raw));
      expect(formatPlate(formatPlate(raw))).toBe(formatPlate(raw));
    }
  });

  it('deux écritures de la même plaque donnent la même chaîne enregistrée (contrainte unique)', () => {
    expect(formatPlate('8921-ب-14')).toBe(formatPlate('8921 | ب | 14'));
    expect(formatPlate('WW482190')).toBe(formatPlate('ww 482190'));
  });

  it('saisie en forme de plaque : parties et plaque complète', () => {
    expect(splitPlate('68013 | ب | 72')).toEqual({ number: '68013', letter: 'ب', region: '72' });
    expect(splitPlate('WW 12')).toEqual({ number: '', letter: '', region: '' });
    expect(joinPlate({ number: '68013', letter: 'ب', region: '72' })).toBe('68013 | ب | 72');
    expect(joinPlate({ number: '68013', letter: '', region: '72' })).toBe('');
    expect(joinPlate({ number: '', letter: 'ب', region: '72' })).toBe('');
    expect(joinWw('482 190')).toBe('WW 482190');
    expect(joinWw('')).toBe('');
  });
});

describe('VIN', () => {
  it('17 caractères, sans I, O ni Q', () => {
    expect(isValidVin('1HGCM82633A004352')).toBe(true);
    expect(isValidVin('1hgcm82633a004352')).toBe(true);
    expect(isValidVin('1HGCM82633A00435')).toBe(false); // 16
    expect(isValidVin('1HGCM82633A0043521')).toBe(false); // 18
    expect(isValidVin('1HGCM82633A00435I')).toBe(false); // I
    expect(isValidVin('OHGCM82633A004352')).toBe(false); // O
    expect(isValidVin('1HGCM82633A00435Q')).toBe(false); // Q
    expect(vinKey(' 1hg-cm82633 a004352 ')).toBe('1HGCM82633A004352');
  });

  it('retrouve un VIN dans un code-barres avec préfixe', () => {
    expect(extractVin('I1HGCM82633A004352')).toBe('1HGCM82633A004352');
    expect(extractVin('1HGCM82633A004352')).toBe('1HGCM82633A004352');
    expect(extractVin('pas un vin')).toBeNull();
  });
});

describe('détection des doublons', () => {
  const fleet = [v('a', '8921 | ب | 14', { vin: '1HGCM82633A004352' }), v('b', 'WW 482190'), v('c', '33507-أ-6', { archivedAt: '2030-01-01T00:00:00Z' })];

  it('plaque : écritures différentes, même véhicule', () => {
    expect(findExistingVehicle(fleet, { plate: '8921-ب-14' })).toMatchObject({ field: 'immatriculation', vehicle: { id: 'a' }, archived: false });
    expect(findExistingVehicle(fleet, { plate: '8921 ب 14' })?.vehicle.id).toBe('a');
    expect(findExistingVehicle(fleet, { plate: 'ww482190' })?.vehicle.id).toBe('b');
  });

  it('VIN : trouvé même sans plaque, la plaque l’emporte sur le VIN', () => {
    expect(findExistingVehicle(fleet, { vin: '1hgcm82633a004352' })).toMatchObject({ field: 'vin', vehicle: { id: 'a' } });
    expect(findExistingVehicle(fleet, { plate: 'WW 482190', vin: '1HGCM82633A004352' })).toMatchObject({ field: 'immatriculation', vehicle: { id: 'b' } });
  });

  it('un véhicule archivé compte, et est marqué comme tel', () => {
    expect(findExistingVehicle(fleet, { plate: '33507 | أ | 6' })).toMatchObject({ vehicle: { id: 'c' }, archived: true });
  });

  it('pas de doublon : plaque inconnue, VIN trop court, ou le véhicule lui-même (modification)', () => {
    expect(findExistingVehicle(fleet, { plate: '1111 | د | 1' })).toBeNull();
    expect(findExistingVehicle(fleet, { vin: '1HG' })).toBeNull();
    expect(findExistingVehicle(fleet, { plate: '8921-ب-14' }, 'a')).toBeNull();
    expect(findExistingVehicle(fleet, {})).toBeNull();
  });

  it('nombre de locations : annulées exclues', () => {
    const rentals = [{ vehicleId: 'a', statut: 'terminee' }, { vehicleId: 'a', statut: 'en_cours' }, { vehicleId: 'a', statut: 'annulee' }, { vehicleId: 'b', statut: 'terminee' }] as never[];
    expect(rentalCount(rentals, 'a')).toBe(2);
    expect(rentalCount(rentals, 'z')).toBe(0);
  });

  it('plaques déjà enregistrées qui seraient en double une fois normalisées', () => {
    const groups = duplicatePlateGroups([v('1', '8921 | ب | 14'), v('2', '8921-ب-14'), v('3', '8921 ب 14'), v('4', 'WW 1'), v('5', '1234 | هـ | 5'), v('6', '1234-ه-5')]);
    expect(groups.map((g) => g.vehicleIds)).toEqual([['1', '2', '3'], ['5', '6']]);
    expect(duplicatePlateGroups([v('1', '8921 | ب | 14'), v('2', '8921 | ب | 15')])).toEqual([]);
  });
});

describe('dernières vérifications', () => {
  const check = (query: string, kind: RecentCheck['kind'] = 'plate', found = false, at = 1): RecentCheck => ({ query, kind, found, at });

  it('les plus récentes d’abord, 5 au maximum', () => {
    let list: RecentCheck[] = [];
    for (let i = 1; i <= 7; i += 1) list = pushRecentCheck(list, check(`${i}000 | ب | 1`, 'plate', false, i));
    expect(list).toHaveLength(RECENT_CHECKS_MAX);
    expect(list[0].query).toBe('7000 | ب | 1');
  });

  it('la même plaque (écrite autrement) remonte en tête sans doublon', () => {
    const list = pushRecentCheck(pushRecentCheck([], check('8921 | ب | 14')), check('1111 | د | 1'));
    const again = pushRecentCheck(list, check('8921-ب-14', 'plate', true, 5));
    expect(again.map((c) => c.query)).toEqual(['8921-ب-14', '1111 | د | 1']);
    expect(again[0].found).toBe(true);
  });

  it('lecture sûre : valeur abîmée = liste vide', () => {
    expect(parseRecentChecks(null)).toEqual([]);
    expect(parseRecentChecks('pas du json')).toEqual([]);
    expect(parseRecentChecks('{"a":1}')).toEqual([]);
    expect(parseRecentChecks(JSON.stringify([check('x'), { query: 1 }]))).toEqual([check('x')]);
  });
});

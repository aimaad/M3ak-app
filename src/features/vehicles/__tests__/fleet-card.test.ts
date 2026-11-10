import type { MaintenanceItem } from '@/features/maintenance/types';
import type { Rental } from '@/features/rentals/types';

import { actionFor, canAddVehiclePhoto, canSeePrices, contextOf, customerShortName, formatDayLabel, occupancyByVehicle, occupancyTone, parsePlate, plateSpoken, plateText, weekRuns, weekSummary } from '../fleet-card';
import { buildFleetItems, type FleetItem } from '../fleet-model';
import type { Vehicle } from '../types';

const NOW = new Date(2030, 5, 10, 12, 0, 0); // lundi 10 juin 2030, midi
const at = (delta: number, hour = 9) => new Date(2030, 5, 10 + delta, hour).toISOString();
const vehicle = (id: string, statut: Vehicle['statut'], extra: Partial<Vehicle> = {}) => ({ id, marque: 'Dacia', modele: id, statut, kilometrage: 1000, archivedAt: null, ...extra }) as Vehicle;
const rental = (id: string, vehicleId: string, statut: Rental['statut'], startDelta: number, endDelta: number, extra: Partial<Rental> = {}) =>
  ({ id, vehicleId, customerId: 'c1', statut, dateDebutPrevue: at(startDelta), dateFinPrevue: at(endDelta, 18), dateDepartReel: null, dateRetourReel: null, ...extra }) as Rental;
const occupancy = (rentals: Rental[], vehicleId = 'v') => occupancyByVehicle(rentals, NOW).get(vehicleId) ?? 0;

describe('occupation sur 30 jours', () => {
  it('0 % sans location, ou avec des locations qui n’ont pas eu lieu', () => {
    expect(occupancy([])).toBe(0);
    expect(occupancy([rental('a', 'v', 'confirmee', -5, -3), rental('b', 'v', 'annulee', -5, -3)])).toBe(0);
  });

  it('100 % quand le véhicule est loué les 30 jours', () => {
    expect(occupancy([rental('a', 'v', 'terminee', -40, -10), rental('b', 'v', 'en_cours', -9, 5)])).toBe(100);
    expect(occupancy([rental('a', 'v', 'en_cours', -60, 20)])).toBe(100);
  });

  it('compte les jours loués (début et fin compris) : 3 jours sur 30 = 10 %', () => {
    expect(occupancy([rental('a', 'v', 'terminee', -5, -3)])).toBe(10);
  });

  it('une location à cheval sur deux périodes ne compte que ses jours dans la fenêtre', () => {
    // du 40e au 28e jour avant aujourd'hui : seuls les jours −29 et −28 sont dans la fenêtre = 2 jours
    expect(occupancy([rental('a', 'v', 'terminee', -40, -28)])).toBe(7);
    // en cours, commencée il y a 4 jours : jours −4 à aujourd'hui = 5 jours
    expect(occupancy([rental('a', 'v', 'en_cours', -4, 10)])).toBe(17);
  });

  it('dates réelles avant dates prévues', () => {
    // prévue sur 10 jours, retournée au bout de 2 jours : 2 jours comptés, pas 10
    const early = rental('a', 'v', 'terminee', -20, -11, { dateDepartReel: at(-20), dateRetourReel: at(-19) });
    expect(occupancy([early])).toBe(7);
  });

  it('deux locations le même jour ne comptent qu’une fois', () => {
    expect(occupancy([rental('a', 'v', 'terminee', -5, -3), rental('b', 'v', 'terminee', -4, -2)])).toBe(13); // jours −5 à −2 = 4 jours
  });

  it('une location en retard compte jusqu’à aujourd’hui, pas au-delà', () => {
    expect(occupancy([rental('a', 'v', 'en_cours', -3, -1)])).toBe(13); // −3 à aujourd'hui = 4 jours
  });

  it('chaque véhicule a sa propre occupation', () => {
    const map = occupancyByVehicle([rental('a', 'v1', 'terminee', -5, -3), rental('b', 'v2', 'terminee', -20, -1)], NOW);
    expect([map.get('v1'), map.get('v2')]).toEqual([10, 67]);
  });

  it('couleur : ≥ 60 % vert, 30 à 59 % graphite, < 30 % orange', () => {
    expect([occupancyTone(100), occupancyTone(60), occupancyTone(59), occupancyTone(30), occupancyTone(29), occupancyTone(0)]).toEqual(['good', 'good', 'neutral', 'neutral', 'low', 'low']);
  });
});

describe('plaque marocaine', () => {
  it('numéro | lettre | région, toujours dans cet ordre', () => {
    expect(parsePlate('68013 | ب | 72')).toEqual({ number: '68013', letter: 'ب', region: '72' });
    expect(plateText('8921-ب-14')).toBe('8921 | ب | 14');
    expect(plateText('45123 أ 1')).toBe('45123 | أ | 1');
    expect(plateSpoken('8921-ب-14')).toBe('8921 ب 14');
  });
  it('ignore les marques invisibles de sens d’écriture (plaque copiée-collée) : l’ordre ne change jamais', () => {
    expect(plateText('68013 | \u200Eب\u200E | 72')).toBe('68013 | ب | 72');
    expect(plateText('\u202B8921\u202C-ب-14')).toBe('8921 | ب | 14');
    expect(plateSpoken('68013 | \u200Fب | 72')).toBe('68013 ب 72');
    expect(plateText('AB\u200E-123')).toBe('AB-123');
  });
  it('format inconnu : tel quel', () => {
    expect(plateText(' AB-123 ')).toBe('AB-123');
    expect(parsePlate('')).toBeNull();
  });
});

describe('ligne de contexte', () => {
  const customers = new Map([['c1', { nomComplet: 'Youssef Alami' }]]);
  const build = (vehicles: Vehicle[], rentals: Rental[], maintenance: MaintenanceItem[] = []) => {
    const items = buildFleetItems({ vehicles, rentals, maintenance, now: NOW });
    const data = { customers, rentals: new Map(rentals.map((r) => [r.id, r])), maintenance };
    return (id: string) => contextOf(items.find((i) => i.vehicle.id === id) as FleetItem, data);
  };

  it('en location : prénom, initiale et retour prévu', () => {
    const context = build([vehicle('a', 'en_location')], [rental('r', 'a', 'en_cours', -2, 6)])('a');
    expect(context).toMatchObject({ kind: 'rented', name: 'Youssef A.', late: false });
    expect((context as { endDay: string }).endDay).toBe('2030-06-16');
  });

  it('en retard : même ligne, marquée en retard', () => {
    expect(build([vehicle('a', 'en_location')], [rental('r', 'a', 'en_cours', -5, -1)])('a')).toMatchObject({ kind: 'rented', late: true });
  });

  it('disponible : libre jusqu’au jour avant la réservation, ou toute la semaine', () => {
    expect(build([vehicle('a', 'disponible')], [rental('r', 'a', 'confirmee', 3, 4)])('a')).toEqual({ kind: 'free', untilDay: '2030-06-12' });
    expect(build([vehicle('a', 'disponible')], [])('a')).toEqual({ kind: 'free', untilDay: null });
    expect(build([vehicle('a', 'disponible')], [rental('r', 'a', 'confirmee', 20, 22)])('a')).toEqual({ kind: 'free', untilDay: null }); // au-delà des 7 jours
  });

  it('à inspecter ; indisponible ; entretien (retour d’atelier ou « Au garage »)', () => {
    expect(build([vehicle('a', 'a_inspecter')], [])('a')).toEqual({ kind: 'inspect' });
    expect(build([vehicle('a', 'indisponible')], [])('a')).toEqual({ kind: 'unavailable' });
    const withDate = { id: 'm', vehicleId: 'a', statut: 'en_cours', echeanceDate: '2030-06-13', echeanceKm: null } as MaintenanceItem;
    expect(build([vehicle('a', 'maintenance')], [], [withDate])('a')).toEqual({ kind: 'maintenance', returnDay: '2030-06-13', planned: false });
    expect(build([vehicle('a', 'maintenance')], [], [])('a')).toEqual({ kind: 'maintenance', returnDay: null, planned: false });
  });

  it('nom court d’un client', () => {
    expect(customerShortName('Youssef Alami')).toBe('Youssef A.');
    expect(customerShortName('Atlas Voyages SARL')).toBe('Atlas S.');
    expect(customerShortName('Karim')).toBe('Karim');
    expect(customerShortName('  ')).toBeNull();
    expect(customerShortName(null)).toBeNull();
    expect(customerShortName('سارة الإدريسي')).toBe('سارة ا.');
  });
});

describe('frise lue à voix haute', () => {
  const day = (n: number, kind: 'free' | 'rented' | 'immobilized') => ({ key: `2030-06-${String(10 + n).padStart(2, '0')}`, kind });
  const words = { state: { free: 'libre', rented: 'loué', immobilized: 'immobilisé' }, until: (s: string, d: string) => `${s} jusqu'au ${d}`, allWeek: (s: string) => `${s} toute la semaine`, then: ' puis ' };

  it('« libre jusqu’au vendredi 13 puis loué »', () => {
    const week = [day(0, 'free'), day(1, 'free'), day(2, 'free'), day(3, 'free'), day(4, 'rented'), day(5, 'rented'), day(6, 'rented')];
    expect(weekRuns(week)).toEqual([{ kind: 'free', lastDay: '2030-06-13' }, { kind: 'rented', lastDay: '2030-06-16' }]);
    expect(weekSummary(week, words, (key) => formatDayLabel(key, 'fr', 'long'))).toBe("libre jusqu'au jeudi 13 puis loué");
  });
  it('une seule plage : toute la semaine ; trois plages', () => {
    expect(weekSummary(Array.from({ length: 7 }, (_, n) => day(n, 'free')), words, () => '')).toBe('libre toute la semaine');
    expect(weekSummary([day(0, 'immobilized'), day(1, 'free'), day(2, 'rented')], words, (key) => key.slice(-2))).toBe("immobilisé jusqu'au 10 puis libre jusqu'au 11 puis loué");
    expect(weekSummary([], words, () => '')).toBe('');
  });
});

describe('bouton d’action', () => {
  const items = buildFleetItems({
    vehicles: [vehicle('libre', 'disponible'), vehicle('louee', 'en_location'), vehicle('insp', 'a_inspecter'), vehicle('prepa', 'en_preparation'), vehicle('garage', 'maintenance'), vehicle('hs', 'indisponible')],
    rentals: [rental('r1', 'louee', 'en_cours', -2, 6), rental('r0', 'insp', 'terminee', -6, -3, { dateRetourReel: at(-3) })],
    maintenance: [],
    now: NOW,
  });
  const rentals = [rental('r0', 'insp', 'terminee', -6, -3, { dateRetourReel: at(-3) })];
  const action = (id: string, role: 'owner' | 'manager' | 'employee' | null) => actionFor(items.find((i) => i.vehicle.id === id) as FleetItem, role, rentals, NOW);

  it('disponible : Louer, pour tous, nouvelle location préremplie avec le véhicule et aujourd’hui', () => {
    for (const role of ['owner', 'manager', 'employee'] as const) expect(action('libre', role)).toEqual({ kind: 'rent', href: { pathname: '/locations/nouveau', params: { vehicleId: 'libre', date: '2030-06-10' } } });
  });
  it('en location : Prolonger pour le propriétaire et le responsable seulement', () => {
    expect(action('louee', 'owner')).toEqual({ kind: 'extend', href: { pathname: '/locations/[id]', params: { id: 'r1', prolonger: '1' } } });
    expect(action('louee', 'manager')?.kind).toBe('extend');
    expect(action('louee', 'employee')).toBeNull();
    expect(action('louee', null)).toBeNull();
  });
  it('à inspecter : Inspecter (inspection de retour de la dernière location, sinon la fiche) ; entretien : Voir l’entretien', () => {
    expect(action('insp', 'employee')).toEqual({ kind: 'inspect', href: { pathname: '/locations/[id]/inspection-retour', params: { id: 'r0' } } });
    expect(action('prepa', 'employee')).toEqual({ kind: 'inspect', href: { pathname: '/flotte/[id]', params: { id: 'prepa' } } });
    expect(action('garage', 'employee')).toEqual({ kind: 'maintenance', href: { pathname: '/flotte/[id]', params: { id: 'garage', section: 'entretien' } } });
  });
  it('indisponible : aucun bouton', () => {
    expect(action('hs', 'owner')).toBeNull();
  });
});

describe('droits', () => {
  it('seul le propriétaire voit les montants', () => {
    expect([canSeePrices('owner'), canSeePrices('manager'), canSeePrices('employee'), canSeePrices(null)]).toEqual([true, false, false, false]);
  });
  it('l’ajout de photo suit le serveur : tout membre de l’agence, personne si le rôle est inconnu', () => {
    expect([canAddVehiclePhoto('owner'), canAddVehiclePhoto('manager'), canAddVehiclePhoto('employee'), canAddVehiclePhoto(null), canAddVehiclePhoto(undefined)]).toEqual([true, true, true, false, false]);
  });
});

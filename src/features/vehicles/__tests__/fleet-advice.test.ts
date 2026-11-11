import type { Rental } from '@/features/rentals/types';

import { adviceCandidates, isSnoozed, parseSnoozeMap, pickAdvice, SNOOZE_MS, snoozeAdvice, visibleAdvice } from '../fleet-advice';
import { buildFleetItems } from '../fleet-model';
import type { Vehicle } from '../types';

const NOW = new Date(2030, 5, 10, 10, 0, 0);
const iso = (day: number, hour = 9) => new Date(2030, 5, day, hour).toISOString();
const vehicle = (id: string, statut: Vehicle['statut'], modele = id) => ({ id, marque: 'Dacia', modele, statut, archivedAt: null }) as Vehicle;
const booking = (id: string, vehicleId: string, startDay: number, endDay: number) => ({ id, vehicleId, statut: 'confirmee', dateDebutPrevue: iso(startDay), dateFinPrevue: iso(endDay, 18), dateDepartReel: null, dateRetourReel: null }) as Rental;
const returned = (id: string, vehicleId: string, returnDay: number, hour = 9) => ({ id, vehicleId, statut: 'terminee', dateDebutPrevue: iso(returnDay - 3), dateFinPrevue: iso(returnDay), dateDepartReel: iso(returnDay - 3), dateRetourReel: iso(returnDay, hour) }) as Rental;

const fleet = (vehicles: Vehicle[], rentals: Rental[]) => buildFleetItems({ vehicles, rentals, maintenance: [], now: NOW });

describe('Conseil BIBIP : règles', () => {
  it('règle 1 : véhicule disponible sans réservation sur les 7 prochains jours', () => {
    const items = fleet([vehicle('a', 'disponible', 'Troc 2025'), vehicle('b', 'disponible', 'F1')], [booking('r', 'b', 12, 13)]);
    const advice = adviceCandidates({ items, rentals: [], now: NOW });
    expect(advice.map((a) => [a.kind, a.vehicleName])).toEqual([['noBooking', 'Dacia Troc 2025']]); // « F1 » a une réservation jeudi
  });

  it('règle 2 : à inspecter depuis plus de 2 jours, daté du retour réel de la dernière location', () => {
    const vehicles = [vehicle('v', 'a_inspecter', 'Logan')];
    const advice = adviceCandidates({ items: fleet(vehicles, []), rentals: [returned('r1', 'v', 5), returned('r0', 'v', 1)], now: NOW });
    expect(advice).toEqual([{ kind: 'waitingInspection', key: 'waitingInspection:v', vehicleId: 'v', vehicleName: 'Dacia Logan', days: 5 }]);
  });

  it('règle 2 : pas de conseil à 2 jours pile, ni sans location terminée, ni pour un véhicule en préparation', () => {
    const justTwoDays = adviceCandidates({ items: fleet([vehicle('v', 'a_inspecter')], []), rentals: [returned('r', 'v', 8, 10)], now: NOW });
    expect(justTwoDays).toEqual([]); // exactement 48 h : pas « plus de 2 jours »
    expect(adviceCandidates({ items: fleet([vehicle('v', 'a_inspecter')], []), rentals: [], now: NOW })).toEqual([]);
    expect(adviceCandidates({ items: fleet([vehicle('p', 'en_preparation')], []), rentals: [returned('r', 'p', 1)], now: NOW })).toEqual([]);
  });

  it('priorité : la règle 1 passe avant la règle 2', () => {
    const items = fleet([vehicle('libre', 'disponible'), vehicle('v', 'a_inspecter')], []);
    const advice = adviceCandidates({ items, rentals: [returned('r', 'v', 1)], now: NOW });
    expect(advice.map((a) => a.kind)).toEqual(['noBooking', 'waitingInspection']);
    expect(pickAdvice(advice, {}, NOW)?.kind).toBe('noBooking');
  });

  it('aucun conseil : flotte vide ou rien à signaler', () => {
    expect(adviceCandidates({ items: [], rentals: [], now: NOW })).toEqual([]);
    expect(pickAdvice([], {}, NOW)).toBeNull();
  });
});

describe('« Plus tard » : masqué 24 h', () => {
  const advice = adviceCandidates({ items: fleet([vehicle('a', 'disponible'), vehicle('b', 'a_inspecter')], []), rentals: [returned('r', 'b', 1)], now: NOW });

  it('masque le conseil pendant 24 h, puis il revient', () => {
    const snoozed = snoozeAdvice({}, advice[0].key, NOW);
    expect(isSnoozed(snoozed, advice[0].key, NOW)).toBe(true);
    expect(isSnoozed(snoozed, advice[0].key, new Date(NOW.getTime() + SNOOZE_MS - 1))).toBe(true);
    expect(isSnoozed(snoozed, advice[0].key, new Date(NOW.getTime() + SNOOZE_MS))).toBe(false);
  });

  it('un conseil masqué laisse place au suivant, jamais à une carte vide tant qu’il en reste', () => {
    const snoozed = snoozeAdvice({}, advice[0].key, NOW);
    expect(pickAdvice(advice, snoozed, NOW)?.kind).toBe('waitingInspection');
    const bothSnoozed = snoozeAdvice(snoozed, advice[1].key, NOW);
    expect(pickAdvice(advice, bothSnoozed, NOW)).toBeNull();
  });

  it('les masquages expirés sont oubliés', () => {
    const old = { ancien: NOW.getTime() - 1 };
    expect(Object.keys(snoozeAdvice(old, 'nouveau', NOW))).toEqual(['nouveau']);
  });

  it('lecture sûre de la mémoire locale', () => {
    expect(parseSnoozeMap(null)).toEqual({});
    expect(parseSnoozeMap('pas du json')).toEqual({});
    expect(parseSnoozeMap('[1,2]')).toEqual({});
    expect(parseSnoozeMap('{"a":123,"b":"x"}')).toEqual({ a: 123 });
  });
});

describe('Conseil BIBIP : retour en retard (priorité 0)', () => {
  const lateRental = (id: string, vehicleId: string, dueDay: number) =>
    ({ id, vehicleId, customerId: 'c1', statut: 'en_cours', dateDebutPrevue: iso(1), dateFinPrevue: iso(dueDay, 18), dateDepartReel: iso(1), dateRetourReel: null }) as Rental;
  const customers = [{ id: 'c1', nomComplet: 'FOUAD BENNANI', telephone: '+212611223344' }];
  const vehicles = [vehicle('libre', 'disponible'), vehicle('r5', 'en_location', 'Sandero'), vehicle('r2', 'en_location', 'Logan')];
  const rentals = [lateRental('l5', 'r5', 5), lateRental('l2', 'r2', 8)];
  const advice = adviceCandidates({ items: fleet(vehicles, rentals), rentals, customers, now: NOW });

  it('passe avant tous les autres conseils, le plus gros retard d’abord', () => {
    expect(advice.map((a) => [a.kind, a.vehicleName])).toEqual([['late', 'Dacia Sandero'], ['late', 'Dacia Logan'], ['noBooking', 'Dacia libre']]);
    expect(pickAdvice(advice, {}, NOW)?.kind).toBe('late');
  });

  it('porte le client (casse normalisée), son numéro, le jour prévu et la durée', () => {
    expect(advice[0]).toMatchObject({ kind: 'late', key: 'late:r5', customerName: 'Fouad B.', phone: '+212611223344', dueDay: '2030-06-05', late: { amount: 5, unit: 'days' } });
  });

  it('sans client connu : pas de nom ni de numéro', () => {
    const none = adviceCandidates({ items: fleet(vehicles, rentals), rentals, now: NOW });
    expect(none[0]).toMatchObject({ kind: 'late', customerName: null, phone: null });
  });

  it('visible de tous les rôles ; les conseils 1 et 2 (offre, inspection) restent réservés au propriétaire', () => {
    expect(visibleAdvice(advice, true).map((a) => a.kind)).toEqual(['late', 'late', 'noBooking']);
    expect(visibleAdvice(advice, false).map((a) => a.kind)).toEqual(['late', 'late']);
    expect(visibleAdvice(adviceCandidates({ items: fleet([vehicle('libre', 'disponible')], []), rentals: [], now: NOW }), false)).toEqual([]);
  });

  it('« Plus tard » masque le retard 24 h, puis le suivant prend la place', () => {
    const snoozed = snoozeAdvice({}, 'late:r5', NOW);
    expect(pickAdvice(advice, snoozed, NOW)).toMatchObject({ key: 'late:r2' });
    expect(pickAdvice(advice, snoozed, new Date(NOW.getTime() + SNOOZE_MS + 1000))).toMatchObject({ key: 'late:r5' });
  });
});

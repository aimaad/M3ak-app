import type { Rental } from '@/features/rentals/types';

import { adviceCandidates, isSnoozed, parseSnoozeMap, pickAdvice, SNOOZE_MS, snoozeAdvice } from '../fleet-advice';
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

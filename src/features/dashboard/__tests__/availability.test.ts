import type { MaintenanceItem } from '@/features/maintenance/types';
import type { Rental } from '@/features/rentals/types';
import type { Vehicle } from '@/features/vehicles/types';

import { buildAvailability, conflicts, dayKey, freeToday, parcCounts, sortBusy, sortFree } from '../availability';

const NOW = new Date(2026, 10, 7, 15, 0, 0); // sam. 7 nov. 2026, 15 h (heure locale)
const at = (days: number, h = 10) => new Date(2026, 10, 7 + days, h).toISOString();

const vehicle = (id: string, statut: Vehicle['statut'] = 'disponible', extra: Partial<Vehicle> = {}) =>
  ({ id, marque: 'Marque', modele: id, statut, archivedAt: null, ...extra }) as Vehicle;
const rental = (id: string, vehicleId: string, statut: Rental['statut'], d1: number, d2: number, extra: Partial<Rental> = {}) =>
  ({ id, vehicleId, statut, dateDebutPrevue: at(d1), dateFinPrevue: at(d2), dateDepartReel: null, dateRetourReel: null, ...extra }) as Rental;
const maint = (id: string, vehicleId: string, statut: MaintenanceItem['statut'], echeance: number | null) =>
  ({ id, vehicleId, statut, echeanceDate: echeance === null ? null : dayKey(new Date(2026, 10, 7 + echeance)), type: 'vidange' }) as MaintenanceItem;

const run = (vehicles: Vehicle[], rentals: Rental[] = [], maintenance: MaintenanceItem[] = []) =>
  buildAvailability({ vehicles, rentals, maintenance, now: NOW });
const statusOf = (days: ReturnType<typeof run>, vehicleId: string, i: number) => days[i].vehicles.find((v) => v.vehicleId === vehicleId)!;

describe('disponibilités par jour', () => {
  it('7 jours à partir d’aujourd’hui, tout le parc libre sans données', () => {
    const days = run([vehicle('a'), vehicle('b')]);
    expect(days).toHaveLength(7);
    expect(days[0].key).toBe('2026-11-07');
    expect(days[6].key).toBe('2026-11-13');
    expect(days.every((d) => d.counts.free === 2)).toBe(true);
  });

  it('les véhicules archivés ne comptent pas', () => {
    expect(run([vehicle('a'), vehicle('x', 'disponible', { archivedAt: '2026-01-01' })])[0].vehicles).toHaveLength(1);
  });

  it('louée : couvre du début à la fin prévue, avec le jour de retour', () => {
    const days = run([vehicle('a')], [rental('r1', 'a', 'confirmee', 1, 3)]);
    expect(statusOf(days, 'a', 0).status).toBe('free');
    const d = statusOf(days, 'a', 2);
    expect(d.status).toBe('rented');
    expect(d.endDay).toBe('2026-11-10');
    expect(statusOf(days, 'a', 4).status).toBe('free');
  });

  it('retard : occupé en retard aujourd’hui et tous les jours suivants', () => {
    const days = run([vehicle('a', 'en_location')], [rental('r1', 'a', 'en_cours', -5, -1)]);
    for (let i = 0; i < 7; i++) expect(statusOf(days, 'a', i).status).toBe('late');
    expect(days[3].counts.late).toBe(1);
    expect(days[3].counts.free).toBe(0);
  });

  it('retard + location prévue = conflit, le véhicule reste en retard', () => {
    const days = run([vehicle('a')], [rental('late', 'a', 'en_cours', -5, -1), rental('next', 'a', 'confirmee', 3, 5)]);
    expect(statusOf(days, 'a', 1).conflict).toBeUndefined();
    const d = statusOf(days, 'a', 4);
    expect(d.status).toBe('late');
    expect(d.conflict).toEqual({ rentalId: 'next', startDay: '2026-11-10' });
    expect(conflicts(days)).toEqual({ count: 1, firstRentalId: 'next' });
  });

  it('inspection (a_inspecter, en_preparation), entretien (maintenance, prévu le jour J) et indisponible', () => {
    const days = run(
      [vehicle('i1', 'a_inspecter'), vehicle('i2', 'en_preparation'), vehicle('m', 'maintenance'), vehicle('p'), vehicle('u', 'indisponible')],
      [],
      [maint('mp', 'p', 'a_venir', 2)]
    );
    expect(statusOf(days, 'i1', 0).status).toBe('inspection');
    expect(statusOf(days, 'i2', 3).status).toBe('inspection');
    expect(statusOf(days, 'm', 0)).toMatchObject({ status: 'maintenance', atGarage: true });
    expect(statusOf(days, 'p', 1).status).toBe('free');
    expect(statusOf(days, 'p', 2)).toMatchObject({ status: 'maintenance', atGarage: false });
    expect(statusOf(days, 'p', 3).status).toBe('free');
    expect(statusOf(days, 'u', 0).status).toBe('unavailable');
    expect(days[0].counts).toMatchObject({ inspectionMaintenance: 3, unavailable: 1, free: 1 });
  });

  it('un entretien déjà effectué ne bloque pas', () => {
    expect(statusOf(run([vehicle('a')], [], [maint('m', 'a', 'effectuee', 0)]), 'a', 0).status).toBe('free');
  });

  it('à confirmer : réservation en attente de confirmation', () => {
    const d = statusOf(run([vehicle('a')], [rental('r', 'a', 'en_attente_confirmation', 2, 4)]), 'a', 2);
    expect(d).toMatchObject({ status: 'toConfirm', startDay: '2026-11-09' });
  });

  it('priorité : retard > entretien > inspection > indisponible > louée > à confirmer', () => {
    const days = run(
      [vehicle('t', 'disponible'), vehicle('l', 'en_location'), vehicle('m', 'maintenance'), vehicle('i', 'a_inspecter'), vehicle('u', 'indisponible'), vehicle('c')],
      [rental('late', 'l', 'en_cours', -3, -1), rental('rent', 't', 'confirmee', 0, 2), rental('conf', 'c', 'en_attente_confirmation', 0, 2)]
    );
    expect(sortBusy(days[0].vehicles).map((v) => v.vehicleId)).toEqual(['l', 'm', 'i', 'u', 't', 'c']);
  });

  it('libre jusqu’au… : jusqu’à la veille de la prochaine occupation, même au-delà des 7 jours', () => {
    const days = run(
      [vehicle('a'), vehicle('b'), vehicle('c')],
      [rental('r1', 'a', 'confirmee', 3, 4), rental('r2', 'b', 'confirmee', 20, 22)]
    );
    expect(statusOf(days, 'a', 0).freeUntil).toBe('2026-11-09');
    expect(statusOf(days, 'b', 0).freeUntil).toBe('2026-11-26');
    expect(statusOf(days, 'c', 0).freeUntil).toBeNull();
    // Libre le plus longtemps d'abord : aucune réservation, puis la plus lointaine.
    expect(sortFree(days[0].vehicles).map((v) => v.vehicleId)).toEqual(['c', 'b', 'a']);
  });

  it('un seul calcul pour « libres aujourd’hui » : en-tête, Parc et badge du jour sont identiques', () => {
    const days = run(
      [vehicle('a'), vehicle('b'), vehicle('c', 'en_location'), vehicle('d', 'a_inspecter'), vehicle('e', 'indisponible')],
      [rental('r', 'c', 'en_cours', -1, 2)]
    );
    expect(freeToday(days)).toBe(2);
    expect(parcCounts(days)).toEqual({ free: 2, rented: 1, toInspect: 2, total: 5 });
    expect(days[0].counts.free).toBe(freeToday(days));
  });
});

import { buildAvailability, parcCounts } from '@/features/dashboard/availability';
import type { MaintenanceItem } from '@/features/maintenance/types';
import type { Rental } from '@/features/rentals/types';

import { buildFleetItems, buildSections, groupCounts, groupFromStatusParam, matchesGroup, rentedPercent, toggleGroup } from '../fleet-model';
import { RING_CIRCUMFERENCE, ringSegments } from '../ring-geometry';
import type { Vehicle } from '../types';

const NOW = new Date(2030, 5, 10, 10, 0, 0); // lundi 10 juin 2030, heure locale
const iso = (day: number, hour = 9) => new Date(2030, 5, day, hour).toISOString();

const vehicle = (id: string, statut: Vehicle['statut'], extra: Partial<Vehicle> = {}) => ({ id, marque: 'Dacia', modele: id, statut, archivedAt: null, ...extra }) as Vehicle;
const rental = (id: string, vehicleId: string, statut: Rental['statut'], startDay: number, endDay: number) =>
  ({ id, vehicleId, statut, dateDebutPrevue: iso(startDay), dateFinPrevue: iso(endDay, 18), dateDepartReel: statut === 'en_cours' ? iso(startDay) : null, dateRetourReel: null }) as Rental;

describe('flotte : statut d’aujourd’hui et groupes', () => {
  const vehicles = [
    vehicle('libre', 'disponible'),
    vehicle('louee', 'en_location'),
    vehicle('inspecter', 'a_inspecter'),
    vehicle('prepa', 'en_preparation'),
    vehicle('garage', 'maintenance'),
    vehicle('hs', 'indisponible'),
    vehicle('archivee', 'disponible', { archivedAt: iso(1) }),
  ];
  const rentals = [rental('r1', 'louee', 'en_cours', 8, 14)];
  const items = buildFleetItems({ vehicles, rentals, maintenance: [] as MaintenanceItem[], now: NOW });

  it('ne garde que les véhicules actifs et classe chacun dans sa section', () => {
    expect(items).toHaveLength(6);
    const section = (id: string) => items.find((i) => i.vehicle.id === id)?.section;
    expect(section('libre')).toBe('free');
    expect(section('louee')).toBe('rented');
    expect(section('inspecter')).toBe('inspect');
    expect(section('prepa')).toBe('inspect'); // en préparation = « À inspecter »
    expect(section('garage')).toBe('maintenance');
    expect(section('hs')).toBe('unavailable');
  });

  it('3 groupes : disponibles, en location, immobilisés (les quatre statuts immobilisants ensemble)', () => {
    expect(groupCounts(items)).toEqual({ free: 1, rented: 1, immobilized: 4, total: 6 });
  });

  it('sections dans l’ordre : À inspecter, Entretien, Indisponibles, En location, Disponibles ; une section vide n’apparaît pas', () => {
    expect(buildSections(items).map((s) => [s.key, s.items.length])).toEqual([['inspect', 2], ['maintenance', 1], ['unavailable', 1], ['rented', 1], ['free', 1]]);
    expect(buildSections(items.filter((i) => i.group === 'free')).map((s) => s.key)).toEqual(['free']);
    expect(buildSections([])).toEqual([]);
  });

  it('le pourcentage « en route » est celui des véhicules en location', () => {
    expect(rentedPercent(groupCounts(items))).toBe(17);
    expect(rentedPercent({ free: 0, rented: 0, immobilized: 0, total: 0 })).toBe(0);
    expect(rentedPercent({ free: 0, rented: 3, immobilized: 0, total: 3 })).toBe(100);
  });

  it('une tuile active filtre ; un second tap sur la même tuile revient à « Tous »', () => {
    expect(toggleGroup(null, 'free')).toBe('free');
    expect(toggleGroup('free', 'free')).toBeNull();
    expect(toggleGroup('free', 'rented')).toBe('rented');
    expect(items.filter((i) => matchesGroup(i, 'rented')).map((i) => i.vehicle.id)).toEqual(['louee']);
    expect(items.filter((i) => matchesGroup(i, null))).toHaveLength(6);
  });

  it('les liens de l’accueil (?statut=…) ouvrent le bon groupe', () => {
    expect(groupFromStatusParam('disponible')).toBe('free');
    expect(groupFromStatusParam('en_location')).toBe('rented');
    for (const s of ['a_inspecter', 'maintenance', 'en_preparation', 'indisponible']) expect(groupFromStatusParam(s)).toBe('immobilized');
    expect(groupFromStatusParam('tous')).toBeNull();
    expect(groupFromStatusParam(undefined)).toBeNull();
  });

  it('les chiffres sont ceux du bloc Parc de l’accueil (même source)', () => {
    const parc = parcCounts(buildAvailability({ vehicles, rentals, maintenance: [], now: NOW }));
    const counts = groupCounts(items);
    expect([counts.free, counts.rented, counts.immobilized, counts.total]).toEqual([parc.free, parc.rented, parc.toInspect, parc.total]);
  });

  it('la frise a 7 jours, aujourd’hui en premier, et reflète les locations à venir', () => {
    const withBooking = buildFleetItems({ vehicles: [vehicle('v', 'disponible')], rentals: [rental('r', 'v', 'confirmee', 12, 13)], maintenance: [], now: NOW });
    const week = withBooking[0].week;
    expect(week).toHaveLength(7);
    expect(week[0].key).toBe('2030-06-10');
    expect(week.map((d) => d.kind)).toEqual(['free', 'free', 'rented', 'rented', 'free', 'free', 'free']);
  });
});

describe('anneau de répartition', () => {
  const counts = (free: number, rented: number, immobilized: number) => ({ free, rented, immobilized, total: free + rented + immobilized });
  it('un segment par groupe présent, proportionnel, avec un espace entre deux', () => {
    const segments = ringSegments(counts(2, 1, 2));
    expect(segments.map((s) => s.key)).toEqual(['free', 'rented', 'immobilized']);
    const free = segments[0];
    expect(free.length).toBeCloseTo((2 / 5) * RING_CIRCUMFERENCE - 12, 5);
    expect(segments[1].offset).toBeGreaterThan(free.offset + free.length); // espace visible
  });
  it('un seul groupe : cercle complet ; flotte vide : aucun segment', () => {
    expect(ringSegments(counts(0, 4, 0))).toEqual([{ key: 'rented', length: RING_CIRCUMFERENCE, offset: 0 }]);
    expect(ringSegments(counts(0, 0, 0))).toEqual([]);
  });
  it('un petit groupe garde un trait visible', () => {
    expect(ringSegments(counts(100, 1, 0))[1].length).toBeGreaterThanOrEqual(1);
  });
});

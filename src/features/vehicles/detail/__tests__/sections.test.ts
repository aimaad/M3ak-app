import type { Customer } from '@/features/customers/types';
import type { MaintenanceItem } from '@/features/maintenance/types';
import type { Rental } from '@/features/rentals/types';
import { buildWatchItems } from '../../fleet-watch';
import type { Vehicle } from '../../types';
import { buildDues } from '../dues';
import { buildHistory, type VehicleInspection } from '../history';
import { buildSpecs } from '../specs';

const NOW = new Date(2026, 10, 15, 12);
const day = (offset: number) => new Date(2026, 10, 15 + offset, 9).toISOString();
const vehicle = { id: 'v1', marque: 'Dacia', modele: 'Logan', statut: 'disponible', archivedAt: null, kilometrage: 59_000, carburant: 'diesel', categorie: 'economique', transmission: null, couleur: 'Blanc', annee: 2021, nombrePlaces: 5, puissanceFiscale: null, documents: [] } as unknown as Vehicle;
const maint = (extra: Partial<MaintenanceItem>): MaintenanceItem => ({ id: 'm1', vehicleId: 'v1', type: 'vidange', statut: 'a_venir', echeanceDate: null, echeanceKm: null, createdAt: day(-30), dateIntervention: null, garage: null, cout: null, ...extra }) as MaintenanceItem;

describe('échéances', () => {
  it('assurance et visite technique sont toujours listées (sans date : « aucune »)', () => {
    const rows = buildDues({ vehicle, maintenance: [], now: NOW });
    expect(rows.map((row) => [row.type, row.due.kind, row.missingFile])).toEqual([['assurance', 'none', true], ['visite_technique', 'none', true]]);
  });

  it('le document donne la date ; le plus urgent entre document et entretien l’emporte', () => {
    const withDoc = { ...vehicle, documents: [{ type: 'assurance', path: 'p', uploadedAt: day(-5), expiresAt: day(45) }] } as Vehicle;
    const rows = buildDues({ vehicle: withDoc, maintenance: [maint({ id: 'a', type: 'assurance', echeanceDate: day(12) })], now: NOW });
    const insurance = rows.find((row) => row.type === 'assurance');
    expect(insurance?.due).toEqual({ kind: 'days', days: 12 });
    expect(insurance?.missingFile).toBe(false);
    expect(insurance?.maintenanceId).toBe('a');
  });

  it('vidange au kilomètre : km restants ; dépassée = expirée ; les entretiens faits sont ignorés', () => {
    const rows = buildDues({ vehicle, maintenance: [maint({ echeanceKm: 60_200 }), maint({ id: 'f', type: 'freins', statut: 'effectuee', echeanceKm: 1000 })], now: NOW });
    expect(rows.find((row) => row.type === 'vidange')?.due).toEqual({ kind: 'km', km: 1200 });
    expect(rows.find((row) => row.type === 'freins')).toBeUndefined();
    const late = buildDues({ vehicle, maintenance: [maint({ echeanceKm: 58_000 })], now: NOW });
    expect(late.find((row) => row.type === 'vidange')?.urgency).toBe('expired');
    expect(late[0].type).toBe('vidange'); // le plus urgent d'abord
  });

  it('mêmes seuils que « À surveiller » pour ce qui s’y trouve', () => {
    const items = [maint({ id: 'a', type: 'vidange', echeanceDate: day(5) }), maint({ id: 'b', type: 'freins', echeanceDate: day(20) }), maint({ id: 'c', type: 'pneus', echeanceDate: day(-3) })];
    const watch = buildWatchItems({ vehicles: [vehicle], maintenance: items, now: NOW });
    const dues = buildDues({ vehicle, maintenance: items, now: NOW });
    expect(watch.length).toBe(3);
    for (const entry of watch) {
      const row = dues.find((due) => due.type === entry.type);
      expect(row?.urgency).toBe(entry.urgency);
      expect(row?.fill).toBeCloseTo(entry.fill);
    }
  });

  it('échéance lointaine : affichée, « ok »', () => {
    const rows = buildDues({ vehicle, maintenance: [maint({ echeanceDate: day(90) })], now: NOW });
    expect(rows.find((row) => row.type === 'vidange')?.urgency).toBe('ok');
  });
});

describe('fiche technique', () => {
  it('donnée absente = « À compléter » (boîte, puissance) ; km à 0 aussi', () => {
    const tiles = buildSpecs({ ...vehicle, kilometrage: 0 });
    expect(tiles.filter((tile) => tile.missing).map((tile) => tile.key)).toEqual(['transmission', 'kilometrage', 'puissanceFiscale']);
    expect(tiles.find((tile) => tile.key === 'carburant')).toMatchObject({ missing: false, valueKey: 'vehicle.fuel.diesel' });
    expect(tiles.find((tile) => tile.key === 'couleur')).toMatchObject({ value: 'Blanc' });
  });

  it('chaque tuile ouvre le champ du même nom', () => {
    expect(buildSpecs(vehicle).every((tile) => tile.field === tile.key)).toBe(true);
  });
});

describe('historique', () => {
  const customers = new Map([['c1', { id: 'c1', nomComplet: 'FOUAD BENNANI' } as Customer]]);
  const rental = (extra: Partial<Rental>) => ({ id: 'r1', customerId: 'c1', statut: 'terminee', dateDebutPrevue: day(-9), dateDepartReel: day(-9), dateRetourReel: day(-2), dateFinPrevue: day(-2), dureeJours: 7, prixTotal: 3500, ...extra }) as Rental;
  const inspection = (extra: Partial<VehicleInspection>) => ({ id: 'i1', rentalId: 'r1', type: 'depart', statut: 'terminee', skipped: false, dateInspection: day(-9), damageCount: 0, ...extra }) as VehicleInspection;

  it('trie du plus récent au plus ancien, mélange locations, inspections et entretiens faits', () => {
    const events = buildHistory({
      rentals: [rental({}), rental({ id: 'old', dateDepartReel: day(-40), dateDebutPrevue: day(-40) }), rental({ id: 'x', statut: 'annulee' })],
      inspections: [inspection({}), inspection({ id: 'skip', skipped: true }), inspection({ id: 'run', statut: 'en_cours' })],
      maintenance: [maint({ id: 'done', statut: 'effectuee', dateIntervention: day(-20), cout: 450 }), maint({ id: 'todo' })],
      customers,
      showAmounts: true,
    });
    expect(events.map((event) => event.key)).toEqual(['rental:r1', 'inspection:i1', 'maintenance:done', 'rental:old']);
    expect(events[0]).toMatchObject({ name: 'Fouad B.', amount: 3500, days: 7 });
  });

  it('employé : aucun montant dans les événements', () => {
    const events = buildHistory({ rentals: [rental({})], inspections: [], maintenance: [maint({ id: 'd', statut: 'effectuee', cout: 450 })], customers, showAmounts: false });
    expect(events.every((event) => !('amount' in event) || event.amount === null)).toBe(true);
    expect(JSON.stringify(events)).not.toMatch(/3500|450/);
  });

  it('limite : les 4 plus récents', () => {
    const rentals = Array.from({ length: 6 }, (_, index) => rental({ id: `r${index}`, dateDepartReel: day(-index - 1) }));
    const events = buildHistory({ rentals, inspections: [], maintenance: [], customers, showAmounts: true, limit: 4 });
    expect(events.map((event) => event.key)).toEqual(['rental:r0', 'rental:r1', 'rental:r2', 'rental:r3']);
  });
});

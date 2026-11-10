import type { MaintenanceItem, MaintenanceStatus, MaintenanceType } from '@/features/maintenance/types';

import { buildWatchItems, daysUntil } from '../fleet-watch';
import type { Vehicle, VehicleDocument } from '../types';

const NOW = new Date(2030, 5, 10, 10, 0, 0); // 10 juin 2030
const day = (delta: number) => {
  const d = new Date(2030, 5, 10 + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const vehicle = (id: string, extra: Partial<Vehicle> = {}) => ({ id, marque: 'Dacia', modele: id, kilometrage: 10_000, documents: [], archivedAt: null, ...extra }) as Vehicle;
const doc = (type: VehicleDocument['type'], expiresInDays: number | null): VehicleDocument => ({ type, path: 'p', uploadedAt: day(-100), expiresAt: expiresInDays === null ? null : day(expiresInDays) });
const maint = (id: string, vehicleId: string, type: MaintenanceType, extra: Partial<MaintenanceItem> = {}) => ({ id, vehicleId, type, echeanceDate: null, echeanceKm: null, statut: 'a_venir' as MaintenanceStatus, ...extra }) as MaintenanceItem;

describe('À surveiller : documents et entretiens', () => {
  it('jours restants en jours civils', () => {
    expect(daysUntil(day(0), NOW)).toBe(0);
    expect(daysUntil(day(5), NOW)).toBe(5);
    expect(daysUntil(day(-3), NOW)).toBe(-3);
    expect(daysUntil(`${day(2)}T23:00:00Z`, NOW)).toBe(2);
  });

  it('documents : dans les 30 jours ou dépassés, pas au-delà ; jamais sans date', () => {
    const items = buildWatchItems({
      vehicles: [vehicle('a', { documents: [doc('assurance', 30), doc('visite_technique', 31), doc('carte_grise', null)] }), vehicle('b', { documents: [doc('assurance', -2)] })],
      maintenance: [],
      now: NOW,
    });
    expect(items.map((i) => [i.vehicleId, i.type, i.urgency])).toEqual([['b', 'assurance', 'expired'], ['a', 'assurance', 'normal']]);
  });

  it('la plus urgente : ≤ 7 jours ou ≤ 500 km ; sinon normale ; dépassée : « Expirée »', () => {
    const items = buildWatchItems({
      vehicles: [vehicle('a', { documents: [doc('assurance', 7)] }), vehicle('b', { documents: [doc('assurance', 8)] }), vehicle('c', { kilometrage: 9_500 }), vehicle('d', { kilometrage: 9_499 }), vehicle('e', { kilometrage: 10_100 })],
      maintenance: [maint('m1', 'c', 'vidange', { echeanceKm: 10_000 }), maint('m2', 'd', 'vidange', { echeanceKm: 10_000 }), maint('m3', 'e', 'vidange', { echeanceKm: 10_000 })],
      now: NOW,
    });
    const urgency = (id: string) => items.find((i) => i.vehicleId === id)?.urgency;
    expect(urgency('a')).toBe('hot'); // J-7
    expect(urgency('b')).toBe('normal'); // J-8
    expect(urgency('c')).toBe('hot'); // 500 km restants
    expect(urgency('d')).toBe('normal'); // 501 km
    expect(urgency('e')).toBe('expired'); // kilométrage dépassé
  });

  it('entretien : 1 000 km (inclus) et 30 jours (inclus), pas au-delà ; terminé ou en cours ignoré', () => {
    const items = buildWatchItems({
      vehicles: [vehicle('a', { kilometrage: 9_000 }), vehicle('b', { kilometrage: 8_999 }), vehicle('c')],
      maintenance: [
        maint('km-ok', 'a', 'vidange', { echeanceKm: 10_000 }),
        maint('km-loin', 'b', 'vidange', { echeanceKm: 10_000 }),
        maint('date-ok', 'c', 'freins', { echeanceDate: day(30) }),
        maint('date-loin', 'c', 'pneus', { echeanceDate: day(31) }),
        maint('fait', 'c', 'autre', { echeanceDate: day(1), statut: 'effectuee' }),
        maint('garage', 'c', 'panne', { echeanceDate: day(1), statut: 'en_cours' }),
      ],
      now: NOW,
    });
    expect(items.map((i) => i.key).sort()).toEqual(['maint:date-ok', 'maint:km-ok']);
  });

  it('date ET kilométrage : on garde le plus pressant', () => {
    const [item] = buildWatchItems({ vehicles: [vehicle('a', { kilometrage: 9_900 })], maintenance: [maint('m', 'a', 'vidange', { echeanceDate: day(20), echeanceKm: 10_000 })], now: NOW });
    expect(item.due).toEqual({ kind: 'km', km: 100 });
    expect(item.urgency).toBe('hot');
  });

  it('tri par urgence : dépassées d’abord, puis les plus proches', () => {
    const items = buildWatchItems({
      vehicles: [vehicle('a', { documents: [doc('assurance', 20)] }), vehicle('b', { documents: [doc('assurance', 3)] }), vehicle('c', { documents: [doc('assurance', -10)] })],
      maintenance: [],
      now: NOW,
    });
    expect(items.map((i) => i.vehicleId)).toEqual(['c', 'b', 'a']);
  });

  it('barre d’urgence : d’autant plus pleine que l’échéance est proche, jamais vide', () => {
    const fill = (days: number) => buildWatchItems({ vehicles: [vehicle('a', { documents: [doc('assurance', days)] })], maintenance: [], now: NOW })[0].fill;
    expect(fill(0)).toBe(1);
    expect(fill(15)).toBeCloseTo(0.5, 5);
    expect(fill(30)).toBe(0.06);
    expect(fill(-1)).toBe(1);
    expect(fill(3)).toBeGreaterThan(fill(10));
  });

  it('assurance / visite technique en double (document et entretien) : un seul, le plus urgent', () => {
    const items = buildWatchItems({
      vehicles: [vehicle('a', { documents: [doc('assurance', 25)] })],
      maintenance: [maint('m', 'a', 'assurance', { echeanceDate: day(4) })],
      now: NOW,
    });
    expect(items).toHaveLength(1);
    expect(items[0].source).toBe('maintenance');
    expect(items[0].due).toEqual({ kind: 'days', days: 4 });
  });

  it('véhicules archivés ignorés ; cible : documents ou entretien', () => {
    const items = buildWatchItems({
      vehicles: [vehicle('a', { archivedAt: day(-1), documents: [doc('assurance', 1)] }), vehicle('b', { documents: [doc('assurance', 2)] })],
      maintenance: [maint('m', 'a', 'vidange', { echeanceDate: day(1) }), maint('n', 'b', 'vidange', { echeanceDate: day(1) })],
      now: NOW,
    });
    expect(items.map((i) => [i.vehicleId, i.target])).toEqual([['b', 'entretien'], ['b', 'documents']]);
  });

  it('un entretien en retard sans date ni kilométrage : dépassé', () => {
    const [item] = buildWatchItems({ vehicles: [vehicle('a')], maintenance: [maint('m', 'a', 'freins', { statut: 'en_retard' })], now: NOW });
    expect(item.urgency).toBe('expired');
  });

  it('rien à signaler : liste vide', () => {
    expect(buildWatchItems({ vehicles: [vehicle('a', { documents: [doc('assurance', 200)] })], maintenance: [], now: NOW })).toEqual([]);
  });
});

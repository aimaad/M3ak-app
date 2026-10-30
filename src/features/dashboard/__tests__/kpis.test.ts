import type { MaintenanceItem } from '@/features/maintenance/types';
import type { Payment } from '@/features/payments/types';
import type { Rental } from '@/features/rentals/types';
import type { Vehicle } from '@/features/vehicles/types';

import {
  balancesToCollectToday,
  computeDashboardMetrics,
  maintenanceSummary,
  occupancyRate,
  outstandingBalances,
  rentalActivity,
  revenueLastMonths,
  revenueSummary,
  underusedVehicles,
  vehiclePerformance,
} from '../kpis';

const NOW = new Date(2026, 9, 17, 12, 0, 0); // 17 octobre 2026, midi (heure locale)
const iso = (y: number, m: number, d: number, h = 10) => new Date(y, m - 1, d, h).toISOString();

const vehicle = (id: string, overrides: Partial<Vehicle> = {}) =>
  ({ id, marque: 'Dacia', modele: id, statut: 'disponible', archivedAt: null, ...overrides }) as Vehicle;
const rental = (id: string, overrides: Partial<Rental> = {}) =>
  ({ id, vehicleId: 'v1', customerId: 'c1', statut: 'terminee', dateDebutPrevue: iso(2026, 10, 1), dateFinPrevue: iso(2026, 10, 5), dateDepartReel: null, dateRetourReel: null, prixTotal: 1000, dureeJours: 4, createdAt: iso(2026, 10, 1), ...overrides }) as Rental;
const payment = (id: string, rentalId: string, montant: number, datePaiement: string, statut: Payment['statut'] = 'paye') =>
  ({ id, rentalId, montant, datePaiement, statut, methode: 'especes', agencyId: 'a' }) as Payment;
const maint = (id: string, overrides: Partial<MaintenanceItem>) =>
  ({ id, vehicleId: 'v1', type: 'vidange', statut: 'effectuee', cout: null, dateIntervention: null, ...overrides }) as MaintenanceItem;

describe('revenus', () => {
  const payments = [
    payment('p1', 'r1', 1000, iso(2026, 10, 3)),
    payment('p2', 'r1', 500, iso(2026, 10, 10)),
    payment('p3', 'r1', 200, iso(2026, 10, 11), 'rembourse'),
    payment('p4', 'r1', 999, iso(2026, 10, 12), 'en_attente'), // ne compte pas
    payment('p5', 'r2', 800, iso(2026, 9, 20)),
  ];

  it('compte seulement le payé, moins les remboursements, et compare au mois précédent', () => {
    expect(revenueSummary(payments, NOW)).toEqual({ current: 1300, previous: 800, changePct: 63 });
  });

  it("n'invente pas de variation sans mois précédent", () => {
    expect(revenueSummary([payment('p', 'r', 100, iso(2026, 10, 3))], NOW).changePct).toBeNull();
  });

  it('donne les 6 derniers mois dans l\'ordre, mois courant inclus', () => {
    const points = revenueLastMonths(payments, 6, NOW);
    expect(points.map((p) => p.date)).toEqual(['2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01']);
    expect(points[4].total).toBe(800);
    expect(points[5].total).toBe(1300);
  });
});

describe('soldes à encaisser', () => {
  const rentals = [
    rental('r1', { statut: 'terminee', prixTotal: 1000 }),
    rental('r2', { statut: 'en_cours', prixTotal: 600 }),
    rental('r3', { statut: 'annulee', prixTotal: 500 }), // ignorée
    rental('r4', { statut: 'confirmee', prixTotal: 700 }), // pas encore partie : ignorée
  ];
  const payments = [payment('p1', 'r1', 1000, iso(2026, 10, 3)), payment('p2', 'r2', 200, iso(2026, 10, 4))];

  it('additionne les soldes des locations commencées ou terminées', () => {
    expect(outstandingBalances(rentals, payments)).toEqual({ total: 400, count: 1 });
  });

  it("ne descend jamais sous zéro en cas de trop-perçu", () => {
    expect(outstandingBalances([rental('r1', { prixTotal: 100 })], [payment('p', 'r1', 500, iso(2026, 10, 3))])).toEqual({ total: 0, count: 0 });
  });

  it("à encaisser aujourd'hui : retour prévu aujourd'hui ou en retard avec un solde", () => {
    const list = [
      rental('late', { statut: 'en_cours', dateFinPrevue: iso(2026, 10, 15), prixTotal: 500 }),
      rental('today', { statut: 'en_cours', dateFinPrevue: iso(2026, 10, 17, 18), prixTotal: 300 }),
      rental('later', { statut: 'en_cours', dateFinPrevue: iso(2026, 10, 25), prixTotal: 900 }),
    ];
    expect(balancesToCollectToday(list, [], NOW)).toEqual({ count: 2, total: 800 });
  });
});

describe('occupation et rentabilité par véhicule', () => {
  const vehicles = [vehicle('v1'), vehicle('v2'), vehicle('v3', { archivedAt: iso(2026, 1, 1) })];
  const from = new Date(2026, 9, 1);
  const to = new Date(2026, 9, 11); // 10 jours
  const rentals = [
    rental('r1', { vehicleId: 'v1', statut: 'terminee', dateDepartReel: iso(2026, 10, 1, 8), dateRetourReel: iso(2026, 10, 6, 8) }), // 5 jours
    rental('r2', { vehicleId: 'v2', statut: 'annulee' }),
  ];

  it('calcule le taux d\'occupation sur la période, sans les véhicules archivés ni les locations annulées', () => {
    expect(occupancyRate(vehicles, rentals, from, to, NOW)).toBe(25); // 5 jours / (2 véhicules × 10 jours)
    expect(occupancyRate([], rentals, from, to, NOW)).toBe(0);
  });

  it('calcule revenus, frais d\'entretien et résultat par véhicule', () => {
    const payments = [payment('p1', 'r1', 1000, iso(2026, 10, 3))];
    const maintenance = [maint('m1', { vehicleId: 'v1', cout: 300, dateIntervention: iso(2026, 10, 4) }), maint('m2', { vehicleId: 'v1', cout: 999, statut: 'a_venir' })];
    const performance = vehiclePerformance(vehicles, rentals, payments, maintenance, from, to, NOW);
    expect(performance).toHaveLength(2);
    expect(performance.find((p) => p.vehicleId === 'v1')).toMatchObject({ occupancyPct: 50, revenue: 1000, maintenanceCost: 300, profit: 700 });
    expect(performance.find((p) => p.vehicleId === 'v2')).toMatchObject({ occupancyPct: 0, revenue: 0, profit: 0 });
  });

  it('repère les véhicules sous-utilisés, du moins loué au plus loué', () => {
    const performance = vehiclePerformance(vehicles, rentals, [], [], from, to, NOW);
    expect(underusedVehicles(performance).map((p) => p.vehicleId)).toEqual(['v2']);
  });
});

describe('activité du comptoir', () => {
  const rentals = [
    rental('a', { statut: 'en_cours', dateFinPrevue: iso(2026, 10, 14), dateDepartReel: iso(2026, 10, 10) }), // en retard
    rental('b', { statut: 'en_cours', dateFinPrevue: iso(2026, 10, 17, 18), dateDepartReel: iso(2026, 10, 12) }), // retour aujourd'hui
    rental('c', { statut: 'confirmee', dateDebutPrevue: iso(2026, 10, 17, 15), createdAt: iso(2026, 10, 16) }), // départ aujourd'hui
    rental('d', { statut: 'en_attente_confirmation', dateDebutPrevue: iso(2026, 10, 20), createdAt: iso(2026, 10, 16) }),
    rental('e', { statut: 'annulee', createdAt: iso(2026, 10, 2) }),
  ];

  it('compte retards, retours et départs du jour, confirmations en attente et annulations', () => {
    const activity = rentalActivity(rentals, NOW);
    expect(activity).toMatchObject({ active: 2, lateReturns: 1, returnsToday: 1, departuresToday: 1, pendingConfirmation: 1, upcoming7Days: 1, cancelledThisMonth: 1 });
    expect(activity.cancellationRatePct).toBe(Math.round((1 / 5) * 100));
  });

  it('ne calcule pas de moyenne sans données', () => {
    expect(rentalActivity([], NOW)).toMatchObject({ averageDurationDays: null, averageBasket: null, cancellationRatePct: 0 });
  });
});

describe('entretien', () => {
  it('compte retards, échéances, travaux en cours et coût du mois', () => {
    const items = [
      maint('1', { statut: 'en_retard' }),
      maint('2', { statut: 'due' }),
      maint('3', { statut: 'en_cours' }),
      maint('4', { statut: 'effectuee', cout: 450, dateIntervention: iso(2026, 10, 5) }),
      maint('5', { statut: 'effectuee', cout: 900, dateIntervention: iso(2026, 9, 5) }),
    ];
    expect(maintenanceSummary(items, NOW)).toEqual({ overdue: 1, due: 1, inProgress: 1, costThisMonth: 450 });
  });
});

describe('computeDashboardMetrics', () => {
  it("fonctionne sans aucune donnée (nouvelle entreprise) sans NaN ni erreur", () => {
    const metrics = computeDashboardMetrics({ vehicles: [], rentals: [], payments: [], maintenance: [], customers: [], now: NOW });
    expect(metrics.fleetTotal).toBe(0);
    expect(metrics.revenue).toEqual({ current: 0, previous: 0, changePct: null });
    expect(metrics.occupancyMonthPct).toBe(0);
    expect(metrics.revenueTrend).toHaveLength(6);
    expect(Object.values(metrics.activity).every((v) => v === null || Number.isFinite(v))).toBe(true);
  });
});

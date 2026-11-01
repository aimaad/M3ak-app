/**
 * Indicateurs de l'accueil, calculés à partir des données déjà visibles par l'utilisateur (la sécurité par
 * entreprise et par filiale est appliquée en amont par le serveur : un employé rattaché à une filiale ne reçoit que
 * les données de sa filiale). Fonctions pures : la date « maintenant » est un paramètre, pour des tests fiables.
 */
import type { MaintenanceItem } from '@/features/maintenance/types';
import type { Payment } from '@/features/payments/types';
import type { Rental } from '@/features/rentals/types';
import type { Vehicle } from '@/features/vehicles/types';

const DAY_MS = 24 * 60 * 60 * 1000;

export const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());
export const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const addMonths = (date: Date, delta: number) =>
  new Date(date.getFullYear(), date.getMonth() + delta, 1);
const addDays = (date: Date, delta: number) =>
  new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + delta,
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds()
  );
const inRange = (iso: string | null | undefined, from: Date, to: Date) => {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  return time >= from.getTime() && time < to.getTime();
};
const isSameDay = (iso: string | null | undefined, day: Date) =>
  inRange(iso, startOfDay(day), addDays(startOfDay(day), 1));
const activeVehicles = (vehicles: Vehicle[]) => vehicles.filter((v) => !v.archivedAt);

// ---------------------------------------------------------------- périodes

/** Périodes proposées sur l'accueil : le jour, les 7 derniers jours, les 30 derniers jours (aujourd'hui inclus). */
export type DashboardPeriod = 'today' | '7d' | '30d';
/** `month` (mois civil en cours) n'est plus proposé à l'écran : il alimente seulement l'analyse IA, dont le format est fixé côté serveur. */
export type MetricsPeriod = DashboardPeriod | 'month';

export const DASHBOARD_PERIODS: DashboardPeriod[] = ['today', '7d', '30d'];

export type PeriodRange = {
  /** Début (inclus) et fin (exclue) de la période. */
  from: Date;
  to: Date;
  /** Période précédente de même durée, pour la comparaison. */
  previousFrom: Date;
  previousTo: Date;
};

export function periodRange(period: MetricsPeriod, now: Date): PeriodRange {
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  if (period === 'month') {
    const from = startOfMonth(now);
    return { from, to: addMonths(from, 1), previousFrom: addMonths(from, -1), previousTo: from };
  }
  const days = period === 'today' ? 1 : period === '7d' ? 7 : 30;
  const from = addDays(tomorrow, -days);
  return { from, to: tomorrow, previousFrom: addDays(from, -days), previousTo: from };
}

// ---------------------------------------------------------------- argent

/** Encaissé net : paiements « payé » moins remboursements. Les paiements en attente ou échoués ne comptent pas. */
function netAmount(payment: Payment): number {
  if (payment.statut === 'paye') return payment.montant;
  if (payment.statut === 'rembourse') return -payment.montant;
  return 0;
}

export function netCollected(payments: Payment[], from: Date, to: Date): number {
  return payments
    .filter((p) => inRange(p.datePaiement, from, to))
    .reduce((sum, p) => sum + netAmount(p), 0);
}

export type RevenueSummary = { current: number; previous: number; changePct: number | null };

/** Encaissé net sur la période et sur la précédente (par défaut : le mois en cours et le mois d'avant). */
export function revenueSummary(
  payments: Payment[],
  now: Date,
  range: PeriodRange = periodRange('month', now)
): RevenueSummary {
  const current = netCollected(payments, range.from, range.to);
  const previous = netCollected(payments, range.previousFrom, range.previousTo);
  return {
    current,
    previous,
    changePct: previous > 0 ? Math.round(((current - previous) / previous) * 100) : null,
  };
}

export type MonthlyPoint = { date: string; total: number };

/** Encaissements des `months` derniers mois (mois courant inclus), en ordre chronologique. */
export function revenueLastMonths(payments: Payment[], months: number, now: Date): MonthlyPoint[] {
  const points: MonthlyPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const start = addMonths(startOfMonth(now), -i);
    const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`;
    points.push({ date: key, total: netCollected(payments, start, addMonths(start, 1)) });
  }
  return points;
}

/** Encaissements jour par jour sur les `days` derniers jours (aujourd'hui inclus), en ordre chronologique. */
export function revenueLastDays(payments: Payment[], days: number, now: Date): MonthlyPoint[] {
  const points: MonthlyPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const start = addDays(startOfDay(now), -i);
    const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
    points.push({ date: key, total: netCollected(payments, start, addDays(start, 1)) });
  }
  return points;
}

function collectedByRental(payments: Payment[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const payment of payments)
    map.set(payment.rentalId, (map.get(payment.rentalId) ?? 0) + netAmount(payment));
  return map;
}

/** Reste à encaisser sur une location : prix total moins l'encaissé net (jamais négatif). */
export function rentalBalance(rental: Rental, collected: Map<string, number>): number {
  return Math.max(0, (rental.prixTotal ?? 0) - (collected.get(rental.id) ?? 0));
}

/** Locations commencées ou terminées dont le solde n'est pas réglé. */
export function outstandingBalances(
  rentals: Rental[],
  payments: Payment[]
): { total: number; count: number } {
  const collected = collectedByRental(payments);
  let total = 0;
  let count = 0;
  for (const rental of rentals) {
    if (rental.statut !== 'en_cours' && rental.statut !== 'terminee') continue;
    const balance = rentalBalance(rental, collected);
    if (balance > 0) {
      total += balance;
      count += 1;
    }
  }
  return { total, count };
}

// ---------------------------------------------------------------- flotte et rentabilité

function rentalInterval(rental: Rental, now: Date): { start: number; end: number } | null {
  if (rental.statut !== 'en_cours' && rental.statut !== 'terminee') return null;
  const start = new Date(rental.dateDepartReel ?? rental.dateDebutPrevue).getTime();
  const end = new Date(
    rental.dateRetourReel ??
      (rental.statut === 'en_cours' ? now.toISOString() : rental.dateFinPrevue)
  ).getTime();
  return Number.isNaN(start) || Number.isNaN(end) || end <= start ? null : { start, end };
}

/** Jours d'occupation d'une location dans [from, to[ (jours entamés comptés pour un jour). */
function occupiedDays(rental: Rental, from: Date, to: Date, now: Date): number {
  const interval = rentalInterval(rental, now);
  if (!interval) return 0;
  const start = Math.max(interval.start, from.getTime());
  const end = Math.min(interval.end, to.getTime());
  return end > start ? Math.ceil((end - start) / DAY_MS) : 0;
}

const periodDays = (from: Date, to: Date) =>
  Math.max(1, Math.round((to.getTime() - from.getTime()) / DAY_MS));

/** Taux d'occupation de la flotte sur la période (jours loués / jours disponibles), en %. */
export function occupancyRate(
  vehicles: Vehicle[],
  rentals: Rental[],
  from: Date,
  to: Date,
  now: Date
): number {
  const fleet = activeVehicles(vehicles);
  if (fleet.length === 0) return 0;
  const capacity = fleet.length * periodDays(from, to);
  const ids = new Set(fleet.map((v) => v.id));
  const occupied = rentals
    .filter((r) => ids.has(r.vehicleId))
    .reduce((sum, r) => sum + occupiedDays(r, from, to, now), 0);
  return Math.min(100, Math.round((occupied / capacity) * 100));
}

export type VehiclePerformance = {
  vehicleId: string;
  label: string;
  occupancyPct: number;
  revenue: number;
  maintenanceCost: number;
  profit: number;
};

/** Occupation, encaissements, frais d'entretien et résultat par véhicule sur la période. */
export function vehiclePerformance(
  vehicles: Vehicle[],
  rentals: Rental[],
  payments: Payment[],
  maintenance: MaintenanceItem[],
  from: Date,
  to: Date,
  now: Date
): VehiclePerformance[] {
  const days = periodDays(from, to);
  const vehicleOfRental = new Map(rentals.map((r) => [r.id, r.vehicleId]));
  const revenueByVehicle = new Map<string, number>();
  for (const payment of payments) {
    if (!inRange(payment.datePaiement, from, to)) continue;
    const vehicleId = vehicleOfRental.get(payment.rentalId);
    if (vehicleId)
      revenueByVehicle.set(vehicleId, (revenueByVehicle.get(vehicleId) ?? 0) + netAmount(payment));
  }
  const costByVehicle = new Map<string, number>();
  for (const item of maintenance) {
    if (
      item.statut === 'effectuee' &&
      item.cout != null &&
      inRange(item.dateIntervention, from, to)
    ) {
      costByVehicle.set(item.vehicleId, (costByVehicle.get(item.vehicleId) ?? 0) + item.cout);
    }
  }

  return activeVehicles(vehicles).map((vehicle) => {
    const occupied = rentals
      .filter((r) => r.vehicleId === vehicle.id)
      .reduce((sum, r) => sum + occupiedDays(r, from, to, now), 0);
    const revenue = revenueByVehicle.get(vehicle.id) ?? 0;
    const maintenanceCost = costByVehicle.get(vehicle.id) ?? 0;
    return {
      vehicleId: vehicle.id,
      label: `${vehicle.marque} ${vehicle.modele}`.trim(),
      occupancyPct: Math.min(100, Math.round((occupied / days) * 100)),
      revenue,
      maintenanceCost,
      profit: revenue - maintenanceCost,
    };
  });
}

export const UNDERUSED_THRESHOLD_PCT = 20;

/** Véhicules les moins utilisés (occupation sous le seuil), du moins loué au plus loué. */
export function underusedVehicles(
  performance: VehiclePerformance[],
  limit = 3
): VehiclePerformance[] {
  return performance
    .filter((p) => p.occupancyPct < UNDERUSED_THRESHOLD_PCT)
    .sort((a, b) => a.occupancyPct - b.occupancyPct || a.revenue - b.revenue)
    .slice(0, limit);
}

export function topVehiclesByRevenue(
  performance: VehiclePerformance[],
  limit = 3
): VehiclePerformance[] {
  return performance
    .filter((p) => p.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

// ---------------------------------------------------------------- activité du comptoir

export type RentalActivity = {
  active: number;
  lateReturns: number;
  pendingConfirmation: number;
  departuresToday: number;
  returnsToday: number;
  upcoming7Days: number;
  /** Locations démarrées et annulées sur la période. */
  started: number;
  cancelled: number;
  cancellationRatePct: number;
  averageDurationDays: number | null;
  averageBasket: number | null;
};

const isNotStarted = (r: Rental) =>
  r.statut === 'confirmee' || r.statut === 'reservee' || r.statut === 'en_attente_confirmation';

export function rentalActivity(
  rentals: Rental[],
  now: Date,
  range: PeriodRange = periodRange('month', now)
): RentalActivity {
  const today = startOfDay(now);
  const inSevenDays = addDays(today, 8);

  const createdInPeriod = rentals.filter((r) => inRange(r.createdAt, range.from, range.to));
  const cancelled = createdInPeriod.filter((r) => r.statut === 'annulee');
  const kept = createdInPeriod.filter((r) => r.statut !== 'annulee');
  const durations = kept
    .map((r) => r.dureeJours)
    .filter((d): d is number => typeof d === 'number' && d > 0);
  const baskets = kept
    .map((r) => r.prixTotal)
    .filter((p): p is number => typeof p === 'number' && p > 0);
  const average = (values: number[]) =>
    values.length
      ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
      : null;

  return {
    active: rentals.filter((r) => r.statut === 'en_cours').length,
    lateReturns: rentals.filter(
      (r) => r.statut === 'en_cours' && new Date(r.dateFinPrevue).getTime() < now.getTime()
    ).length,
    pendingConfirmation: rentals.filter((r) => r.statut === 'en_attente_confirmation').length,
    departuresToday: rentals.filter((r) => isNotStarted(r) && isSameDay(r.dateDebutPrevue, now))
      .length,
    returnsToday: rentals.filter((r) => r.statut === 'en_cours' && isSameDay(r.dateFinPrevue, now))
      .length,
    upcoming7Days: rentals.filter(
      (r) => isNotStarted(r) && inRange(r.dateDebutPrevue, addDays(today, 1), inSevenDays)
    ).length,
    started: rentals.filter((r) => inRange(r.dateDepartReel, range.from, range.to)).length,
    cancelled: cancelled.length,
    cancellationRatePct: createdInPeriod.length
      ? Math.round((cancelled.length / createdInPeriod.length) * 100)
      : 0,
    averageDurationDays: average(durations),
    averageBasket: baskets.length
      ? Math.round(baskets.reduce((a, b) => a + b, 0) / baskets.length)
      : null,
  };
}

/** Locations à encaisser aujourd'hui : retour prévu aujourd'hui ou en retard, avec un solde non réglé. */
export function balancesToCollectToday(
  rentals: Rental[],
  payments: Payment[],
  now: Date
): { count: number; total: number } {
  const collected = collectedByRental(payments);
  const endOfToday = addDays(startOfDay(now), 1).getTime();
  let count = 0;
  let total = 0;
  for (const rental of rentals) {
    if (rental.statut !== 'en_cours') continue;
    if (new Date(rental.dateFinPrevue).getTime() >= endOfToday) continue;
    const balance = rentalBalance(rental, collected);
    if (balance > 0) {
      count += 1;
      total += balance;
    }
  }
  return { count, total };
}

// ---------------------------------------------------------------- entretien

export type MaintenanceSummary = {
  overdue: number;
  due: number;
  inProgress: number;
  costInPeriod: number;
};

export function maintenanceSummary(
  items: MaintenanceItem[],
  now: Date,
  range: PeriodRange = periodRange('month', now)
): MaintenanceSummary {
  return {
    overdue: items.filter((i) => i.statut === 'en_retard').length,
    due: items.filter((i) => i.statut === 'due').length,
    inProgress: items.filter((i) => i.statut === 'en_cours').length,
    costInPeriod: items
      .filter(
        (i) =>
          i.statut === 'effectuee' &&
          i.cout != null &&
          inRange(i.dateIntervention, range.from, range.to)
      )
      .reduce((sum, i) => sum + (i.cout ?? 0), 0),
  };
}

export function newCustomersInRange(
  customers: { createdAt: string; archivedAt: string | null }[],
  range: PeriodRange
): number {
  return customers.filter((c) => !c.archivedAt && inRange(c.createdAt, range.from, range.to))
    .length;
}

// ---------------------------------------------------------------- tout en un

export type DashboardMetrics = {
  period: MetricsPeriod;
  fleetTotal: number;
  availableNow: number;
  revenue: RevenueSummary;
  /** Encaissements en barres : 6 mois (période `month`), sinon les 7 ou 30 derniers jours. */
  revenueTrend: MonthlyPoint[];
  outstanding: { total: number; count: number };
  occupancyPct: number;
  performance: VehiclePerformance[];
  underused: VehiclePerformance[];
  topVehicles: VehiclePerformance[];
  profit: number;
  activity: RentalActivity;
  toCollectToday: { count: number; total: number };
  maintenance: MaintenanceSummary;
  newCustomers: number;
};

export function computeDashboardMetrics(input: {
  vehicles: Vehicle[];
  rentals: Rental[];
  payments: Payment[];
  maintenance: MaintenanceItem[];
  customers: { createdAt: string; archivedAt: string | null }[];
  now?: Date;
  /** Période des chiffres « sur une durée » (revenus, occupation, résultat…). Par défaut : le mois en cours. */
  period?: MetricsPeriod;
}): DashboardMetrics {
  const now = input.now ?? new Date();
  const period = input.period ?? 'month';
  const fleet = activeVehicles(input.vehicles);
  const range = periodRange(period, now);
  const tomorrow = addDays(startOfDay(now), 1);
  // L'occupation et la performance ne regardent jamais le futur ; pour `month` la performance garde sa fenêtre historique de 30 jours.
  const performanceFrom = period === 'month' ? addDays(startOfDay(now), -30) : range.from;
  const performance = vehiclePerformance(
    input.vehicles,
    input.rentals,
    input.payments,
    input.maintenance,
    performanceFrom,
    tomorrow,
    now
  );

  return {
    period,
    fleetTotal: fleet.length,
    availableNow: fleet.filter((v) => v.statut === 'disponible').length,
    revenue: revenueSummary(input.payments, now, range),
    revenueTrend:
      period === 'month'
        ? revenueLastMonths(input.payments, 6, now)
        : revenueLastDays(input.payments, period === '30d' ? 30 : 7, now),
    outstanding: outstandingBalances(input.rentals, input.payments),
    occupancyPct: occupancyRate(input.vehicles, input.rentals, range.from, tomorrow, now),
    performance,
    underused: underusedVehicles(performance),
    topVehicles: topVehiclesByRevenue(performance),
    profit: performance.reduce((sum, p) => sum + p.profit, 0),
    activity: rentalActivity(input.rentals, now, range),
    toCollectToday: balancesToCollectToday(input.rentals, input.payments, now),
    maintenance: maintenanceSummary(input.maintenance, now, range),
    newCustomers: newCustomersInRange(input.customers, range),
  };
}

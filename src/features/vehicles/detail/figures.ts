/**
 * Chiffres clés de la fiche : revenus sur 30 jours (au prorata des jours), variation, courbe de 6 mois, encaissé, occupation, et frise
 * des 14 prochains jours. Fonctions pures : « maintenant » est un paramètre, tout vient des listes déjà chargées.
 *
 * Règle des revenus : une location en cours ou terminée apporte son prix total RÉPARTI sur ses jours ; seuls les jours dans la période
 * comptent (une location à cheval sur deux périodes est coupée). Les locations annulées, en attente ou réservées n'y entrent pas.
 */
import { buildAvailability, type DayStatus } from '@/features/dashboard/availability';
import type { MaintenanceItem } from '@/features/maintenance/types';
import type { Payment } from '@/features/payments/types';
import type { Rental } from '@/features/rentals/types';
import type { Vehicle } from '../types';

export const REVENUE_DAYS = 30;
export const CALENDAR_DAYS = 14;

const startOfDay = (value: Date | string) => {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};
const addDays = (date: Date, delta: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + delta);
const dayCount = (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;

/** Revenus d'une période [from, to] (jours inclus), au prorata. */
export function revenueBetween(rentals: Rental[], from: Date, to: Date): number {
  const first = startOfDay(from);
  const last = startOfDay(to);
  let total = 0;
  for (const rental of rentals) {
    if (rental.statut !== 'en_cours' && rental.statut !== 'terminee') continue;
    const price = rental.prixTotal ?? 0;
    if (price <= 0) continue;
    const start = startOfDay(rental.dateDepartReel ?? rental.dateDebutPrevue);
    let end = startOfDay(rental.dateRetourReel ?? rental.dateFinPrevue);
    if (end.getTime() < start.getTime()) end = start;
    const overlapStart = start.getTime() > first.getTime() ? start : first;
    const overlapEnd = end.getTime() < last.getTime() ? end : last;
    if (overlapStart.getTime() > overlapEnd.getTime()) continue;
    total += (price * dayCount(overlapStart, overlapEnd)) / dayCount(start, end);
  }
  return Math.round(total);
}

export type RevenueFigure = {
  current: number;
  previous: number;
  /** Variation en % par rapport aux 30 jours précédents ; null s'il n'y a rien à comparer (période précédente vide). */
  variation: number | null;
};

export function revenueLast30(rentals: Rental[], now: Date): RevenueFigure {
  const today = startOfDay(now);
  const current = revenueBetween(rentals, addDays(today, -(REVENUE_DAYS - 1)), today);
  const previous = revenueBetween(rentals, addDays(today, -(2 * REVENUE_DAYS - 1)), addDays(today, -REVENUE_DAYS));
  return { current, previous, variation: previous > 0 ? Math.round(((current - previous) / previous) * 100) : null };
}

/** Revenus par mois civil, du plus ancien au mois en cours (jusqu'à aujourd'hui). */
export function monthlyRevenue(rentals: Rental[], now: Date, months = 6): number[] {
  const today = startOfDay(now);
  return Array.from({ length: months }, (_, index) => {
    const from = new Date(today.getFullYear(), today.getMonth() - (months - 1 - index), 1);
    const monthEnd = new Date(from.getFullYear(), from.getMonth() + 1, 0);
    return revenueBetween(rentals, from, monthEnd.getTime() > today.getTime() ? today : monthEnd);
  });
}

/** Points de la courbe (x de gauche à droite, y de haut en bas) dans un cadre largeur × hauteur avec marge ; courbe plate si tout est égal. */
export function sparkPoints(values: number[], width: number, height: number, margin = 4): { x: number; y: number }[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  return values.map((value, index) => ({
    x: values.length === 1 ? width / 2 : margin + (index * (width - 2 * margin)) / (values.length - 1),
    y: span === 0 ? height / 2 : height - margin - ((value - min) * (height - 2 * margin)) / span,
  }));
}

/** Locations « depuis l'ajout » : toutes sauf les annulées. */
export const rentalsSinceAdded = (rentals: Rental[]) => rentals.filter((rental) => rental.statut !== 'annulee').length;

/** Encaissé sur 30 jours : paiements réglés des locations de CE véhicule, datés dans la fenêtre. */
export function cashedLast30(payments: Payment[], rentals: Rental[], now: Date): number {
  const ids = new Set(rentals.map((rental) => rental.id));
  const today = startOfDay(now);
  const from = addDays(today, -(REVENUE_DAYS - 1));
  return payments
    .filter((payment) => payment.statut === 'paye' && ids.has(payment.rentalId))
    .filter((payment) => {
      const day = startOfDay(payment.datePaiement);
      return day.getTime() >= from.getTime() && day.getTime() <= today.getTime();
    })
    .reduce((sum, payment) => sum + payment.montant, 0);
}

// ------------------------------------------------------------------ 14 prochains jours

export type CalendarKind = 'free' | 'rented' | 'late' | 'immobilised';
export type CalendarDay = { key: string; date: Date; kind: CalendarKind; status: DayStatus; rentalId?: string };

const KIND: Record<DayStatus, CalendarKind> = {
  free: 'free',
  rented: 'rented',
  toConfirm: 'rented',
  late: 'late',
  inspection: 'immobilised',
  maintenance: 'immobilised',
  unavailable: 'immobilised',
};

/** Les 14 prochains jours (aujourd'hui compris) du véhicule, avec la MÊME règle que Disponibilités de l'accueil. Archivé : aucun jour. */
export function calendarDays(input: { vehicle: Vehicle; rentals: Rental[]; maintenance: MaintenanceItem[]; now: Date }): CalendarDay[] {
  return buildAvailability({ vehicles: [input.vehicle], rentals: input.rentals, maintenance: input.maintenance, now: input.now, days: CALENDAR_DAYS }).flatMap((summary) => {
    const day = summary.vehicles[0];
    return day ? [{ key: summary.key, date: summary.date, kind: KIND[day.status], status: day.status, rentalId: day.rentalId }] : [];
  });
}

export type CalendarRun = { kind: CalendarKind; firstDay: string; lastDay: string };

/** Jours consécutifs de même état regroupés (pour la phrase lue à voix haute). */
export function calendarRuns(days: CalendarDay[]): CalendarRun[] {
  const runs: CalendarRun[] = [];
  for (const day of days) {
    const last = runs[runs.length - 1];
    if (last && last.kind === day.kind) last.lastDay = day.key;
    else runs.push({ kind: day.kind, firstDay: day.key, lastDay: day.key });
  }
  return runs;
}

export type CalendarTap = { type: 'rental'; rentalId: string } | { type: 'rent'; day: string } | null;

/** Appui sur un jour : loué/en retard → la location ; libre → nouvelle location à partir de ce jour ; immobilisé → rien. */
export function calendarTap(day: CalendarDay): CalendarTap {
  if (day.rentalId && (day.kind === 'rented' || day.kind === 'late')) return { type: 'rental', rentalId: day.rentalId };
  if (day.kind === 'free') return { type: 'rent', day: day.key };
  return null;
}


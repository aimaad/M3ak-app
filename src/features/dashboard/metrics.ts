import type { VehicleStatus } from '@/features/vehicles/types';

export function computeUtilizationRate(vehicles: { statut: VehicleStatus }[]): number {
  if (vehicles.length === 0) return 0;
  const enLocation = vehicles.filter((v) => v.statut === 'en_location').length;
  return Math.round((enLocation / vehicles.length) * 100);
}

export function sumPaymentsInMonth(
  payments: { montant: number; datePaiement: string }[],
  reference: Date = new Date()
): number {
  const year = reference.getFullYear();
  const month = reference.getMonth();

  return payments
    .filter((payment) => {
      const date = new Date(payment.datePaiement);
      return date.getFullYear() === year && date.getMonth() === month;
    })
    .reduce((sum, payment) => sum + payment.montant, 0);
}

export type DailyRevenuePoint = { date: string; total: number };

function toDateKey(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Revenus par jour sur les `days` derniers jours (aujourd'hui inclus), dans l'ordre
 * chronologique — pour un graphique en barres. Les jours sans paiement valent 0.
 */
export function revenueByDay(
  payments: { montant: number; datePaiement: string }[],
  days: number,
  reference: Date = new Date()
): DailyRevenuePoint[] {
  const totalsByDate = new Map<string, number>();
  for (const payment of payments) {
    const key = toDateKey(payment.datePaiement);
    totalsByDate.set(key, (totalsByDate.get(key) ?? 0) + payment.montant);
  }

  const points: DailyRevenuePoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(reference);
    day.setDate(day.getDate() - i);
    const key = toDateKey(day.toISOString());
    points.push({ date: key, total: totalsByDate.get(key) ?? 0 });
  }
  return points;
}

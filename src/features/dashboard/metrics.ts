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

import { RENTAL_STATUSES, type Rental, type RentalStatus } from './types';

export type RentalStatusFilter = 'tous' | RentalStatus;

export const RENTAL_STATUS_FILTERS: RentalStatusFilter[] = ['tous', ...RENTAL_STATUSES];

export function filterRentalsByStatus(rentals: Rental[], statusFilter: RentalStatusFilter): Rental[] {
  if (statusFilter === 'tous') return rentals;
  return rentals.filter((rental) => rental.statut === statusFilter);
}

export function countRentalsByStatus(rentals: Rental[]): Record<RentalStatusFilter, number> {
  const counts: Record<RentalStatusFilter, number> = {
    tous: rentals.length,
    en_attente_confirmation: 0,
    confirmee: 0,
    reservee: 0,
    en_cours: 0,
    terminee: 0,
    annulee: 0,
  };
  for (const rental of rentals) {
    counts[rental.statut] += 1;
  }
  return counts;
}

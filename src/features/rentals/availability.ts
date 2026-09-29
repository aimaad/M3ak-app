import { ACTIVE_RENTAL_STATUSES, type RentalStatus } from './types';

export type DateRange = { start: string; end: string };

export type RentalForAvailability = {
  id: string;
  dateDebutPrevue: string;
  dateFinPrevue: string;
  statut: RentalStatus;
};

function isActive(statut: RentalStatus): boolean {
  return (ACTIVE_RENTAL_STATUSES as RentalStatus[]).includes(statut);
}

function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return a.start <= b.end && b.start <= a.end;
}

/** true si la période proposée chevauche une location active existante du véhicule. */
export function hasBookingConflict(
  existingRentals: RentalForAvailability[],
  range: DateRange,
  excludeRentalId?: string
): boolean {
  return existingRentals.some((rental) => {
    if (rental.id === excludeRentalId) return false;
    if (!isActive(rental.statut)) return false;
    return rangesOverlap(
      { start: rental.dateDebutPrevue, end: rental.dateFinPrevue },
      range
    );
  });
}

function eachDate(start: string, end: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  while (cursor <= endDate) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

/** Liste (YYYY-MM-DD) de tous les jours occupés par des locations actives, pour affichage calendrier. */
export function bookedDates(existingRentals: RentalForAvailability[]): string[] {
  const dates = new Set<string>();
  for (const rental of existingRentals) {
    if (!isActive(rental.statut)) continue;
    for (const date of eachDate(rental.dateDebutPrevue, rental.dateFinPrevue)) {
      dates.add(date);
    }
  }
  return Array.from(dates).sort();
}

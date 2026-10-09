import { BLOCKING_RENTAL_STATUSES } from './status-transitions';
import type { RentalStatus } from './types';

export type DateRange = { start: string; end: string };

export type RentalForAvailability = {
  id: string;
  dateDebutPrevue: string;
  dateFinPrevue: string;
  statut: RentalStatus;
};

function isBlocking(statut: RentalStatus): boolean {
  return BLOCKING_RENTAL_STATUSES.includes(statut);
}

function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * true si la période proposée chevauche une réservation qui bloque
 * réellement la disponibilité (confirmée, en cours, ou l'ancien statut
 * "reservee"). Les brouillons / en attente de confirmation ne bloquent pas
 * la disponibilité — voir BLOCKING_RENTAL_STATUSES dans status-transitions.ts
 * pour la justification de ce choix. La protection définitive contre les
 * accès concurrents est assurée côté base par une contrainte d'exclusion
 * (voir migrations/0013_rentals_booking_system.sql) : cette fonction ne sert
 * qu'à donner un retour immédiat dans l'interface.
 */
export function hasBookingConflict(
  existingRentals: RentalForAvailability[],
  range: DateRange,
  excludeRentalId?: string
): boolean {
  return existingRentals.some((rental) => {
    if (rental.id === excludeRentalId) return false;
    if (!isBlocking(rental.statut)) return false;
    return rangesOverlap(
      { start: rental.dateDebutPrevue, end: rental.dateFinPrevue },
      range
    );
  });
}

function eachDate(start: string, end: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${start.slice(0, 10)}T00:00:00Z`);
  const endDate = new Date(`${end.slice(0, 10)}T00:00:00Z`);
  while (cursor <= endDate) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

/** Liste (YYYY-MM-DD) de tous les jours occupés par des réservations bloquantes, pour affichage calendrier. */
export function bookedDates(existingRentals: RentalForAvailability[]): string[] {
  const dates = new Set<string>();
  for (const rental of existingRentals) {
    if (!isBlocking(rental.statut)) continue;
    for (const date of eachDate(rental.dateDebutPrevue, rental.dateFinPrevue)) {
      dates.add(date);
    }
  }
  return Array.from(dates).sort();
}

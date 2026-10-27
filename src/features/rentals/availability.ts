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

/** Instants comparés en millisecondes : la base renvoie « …+00:00 », JavaScript « …000Z », et comparer les textes n'est pas fiable. */
function rangesOverlap(a: DateRange, b: DateRange): boolean {
  const [aStart, aEnd, bStart, bEnd] = [a.start, a.end, b.start, b.end].map((value) => new Date(value).getTime());
  return aStart < bEnd && bStart < aEnd;
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

export type VehicleForAvailability = {
  id: string;
  statut: string;
  archivedAt: string | null;
};

export type RentalWithVehicle = RentalForAvailability & { vehicleId: string };

export type UnavailableReason =
  | { kind: 'booked'; freeFrom: string }
  | { kind: 'maintenance' }
  | { kind: 'indisponible' }
  | { kind: 'archived' };

export type VehicleAvailability<V extends VehicleForAvailability> = {
  available: V[];
  unavailable: { vehicle: V; reason: UnavailableReason }[];
  /**
   * Voitures libres, mais avec une réservation « en attente de confirmation » qui chevauche la période : elle ne bloque
   * pas la voiture, mais sa confirmation sera refusée si on loue la voiture entre-temps. À signaler à l'employé.
   */
  pendingOverlaps: Record<string, RentalWithVehicle[]>;
};

/**
 * Pour une période choisie par le client, sépare les véhicules libres de ceux qui ne le sont pas, avec la raison :
 * déjà réservé (et à partir de quand il se libère), en maintenance, indisponible ou archivé. L'employé choisit
 * ainsi la voiture parmi celles qui peuvent vraiment être louées, au lieu de découvrir le conflit après coup.
 */
export function vehicleAvailability<V extends VehicleForAvailability>(
  vehicles: V[],
  rentals: RentalWithVehicle[],
  range: DateRange
): VehicleAvailability<V> {
  const available: V[] = [];
  const unavailable: VehicleAvailability<V>['unavailable'] = [];
  const pendingOverlaps: VehicleAvailability<V>['pendingOverlaps'] = {};
  for (const vehicle of vehicles) {
    if (vehicle.archivedAt) {
      unavailable.push({ vehicle, reason: { kind: 'archived' } });
      continue;
    }
    if (vehicle.statut === 'maintenance') {
      unavailable.push({ vehicle, reason: { kind: 'maintenance' } });
      continue;
    }
    if (vehicle.statut === 'indisponible') {
      unavailable.push({ vehicle, reason: { kind: 'indisponible' } });
      continue;
    }
    const conflicts = rentals.filter(
      (rental) => rental.vehicleId === vehicle.id && isBlocking(rental.statut) && rangesOverlap({ start: rental.dateDebutPrevue, end: rental.dateFinPrevue }, range)
    );
    if (conflicts.length > 0) {
      const freeFrom = conflicts.reduce((latest, rental) => (new Date(rental.dateFinPrevue).getTime() > new Date(latest).getTime() ? rental.dateFinPrevue : latest), conflicts[0].dateFinPrevue);
      unavailable.push({ vehicle, reason: { kind: 'booked', freeFrom } });
    } else {
      available.push(vehicle);
      const pending = rentals.filter(
        (rental) =>
          rental.vehicleId === vehicle.id &&
          rental.statut === 'en_attente_confirmation' &&
          rangesOverlap({ start: rental.dateDebutPrevue, end: rental.dateFinPrevue }, range)
      );
      if (pending.length > 0) pendingOverlaps[vehicle.id] = pending;
    }
  }
  return { available, unavailable, pendingOverlaps };
}

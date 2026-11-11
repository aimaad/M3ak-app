import type { Customer } from '@/features/customers/types';
import type { Rental } from '@/features/rentals/types';

import { customerShortName } from './fleet-card';
import type { Vehicle } from './types';

/**
 * Un véhicule réservé ou en location ne peut pas être archivé (règle aussi appliquée côté serveur :
 * migration 0030). Toute location qui n'est ni terminée ni annulée compte, y compris l'ancien statut "reservee".
 */
export function hasActiveRental(vehicle: Pick<Vehicle, 'statut'>, rentals: Pick<Rental, 'statut'>[]): boolean {
  if (vehicle.statut === 'en_location') return true;
  return rentals.some((rental) => rental.statut !== 'terminee' && rental.statut !== 'annulee');
}

export function isArchiveBlockedError(error: unknown): boolean {
  const message = typeof error === 'object' && error !== null && 'message' in error ? String((error as { message: unknown }).message) : '';
  return message.includes('vehicle_has_active_rentals');
}

// ------------------------------------------------------------------ raison précise du blocage

/** Pourquoi un véhicule ne peut pas être archivé : la location la plus urgente + le nombre d'autres réservations qui bloquent aussi. */
export type ArchiveBlock = {
  kind: 'late' | 'rented' | 'reserved' | 'status';
  /** Prénom + initiale du client ; null si inconnu. */
  name: string | null;
  /** Jour AAAA-MM-JJ utile à la phrase : retour prévu (late, rented) ou début (reserved). */
  day: string | null;
  rentalId: string | null;
  /** Autres locations qui bloquent aussi (hors la principale). */
  others: number;
};

const dayOf = (iso: string) => {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/**
 * Null si l'archivage est possible. Sinon : en retard (en cours et fin prévue dépassée) avant en location, avant la réservation la
 * plus proche. Même règle de blocage que le serveur (toute location qui n'est ni terminée ni annulée).
 */
export function archiveBlock(
  vehicle: Pick<Vehicle, 'statut'>,
  rentals: Pick<Rental, 'id' | 'statut' | 'customerId' | 'dateDebutPrevue' | 'dateFinPrevue'>[],
  customers: Map<string, Pick<Customer, 'nomComplet'>>,
  now: Date
): ArchiveBlock | null {
  const blocking = rentals.filter((rental) => rental.statut !== 'terminee' && rental.statut !== 'annulee');
  const nameOf = (rental: { customerId: string }) => customerShortName(customers.get(rental.customerId)?.nomComplet);
  if (blocking.length === 0) return vehicle.statut === 'en_location' ? { kind: 'status', name: null, day: null, rentalId: null, others: 0 } : null;

  const rank = (rental: (typeof blocking)[number]) =>
    rental.statut === 'en_cours' ? (new Date(rental.dateFinPrevue).getTime() < now.getTime() ? 0 : 1) : 2;
  const ordered = [...blocking].sort((a, b) => rank(a) - rank(b) || a.dateDebutPrevue.localeCompare(b.dateDebutPrevue));
  const main = ordered[0];
  const kind = rank(main) === 0 ? 'late' : rank(main) === 1 ? 'rented' : 'reserved';
  return {
    kind,
    name: nameOf(main),
    day: dayOf(kind === 'reserved' ? main.dateDebutPrevue : main.dateFinPrevue),
    rentalId: main.id,
    others: ordered.length - 1,
  };
}

/** Nombre de locations bloquantes annoncé par le serveur (« count=2 » dans le détail de l'erreur) ; null si absent. */
export function blockingCountFromError(error: unknown): number | null {
  const details = typeof error === 'object' && error !== null && 'details' in error ? String((error as { details: unknown }).details) : '';
  const match = /count=(\d+)/.exec(details);
  return match ? Number(match[1]) : null;
}

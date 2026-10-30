import type { Rental } from '@/features/rentals/types';

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

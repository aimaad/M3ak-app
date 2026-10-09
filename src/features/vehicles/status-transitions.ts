import { SYSTEM_MANAGED_STATUSES, type VehicleStatus } from './types';

/**
 * Un statut géré par le module locations (véhicule en cours de location ou
 * en attente d'inspection de retour) ne doit pas pouvoir être changé à la
 * main depuis la fiche véhicule : ça court-circuiterait le suivi de la
 * location en cours (double réservation possible).
 */
export function canManuallyChangeStatus(currentStatus: VehicleStatus): boolean {
  return !SYSTEM_MANAGED_STATUSES.includes(currentStatus);
}

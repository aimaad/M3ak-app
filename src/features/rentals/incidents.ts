import type { Rental } from './types';

export type RentalIncident = { rentalId: string; type: 'retard' | 'annulee' };

/**
 * Incidents dérivés des locations existantes (pas de table dédiée) : retard
 * au retour (retour réel après la fin prévue) et réservations annulées.
 * Les dommages détectés par l'inspection IA ne sont pas encore structurés
 * (étape 3 du ROADMAP), donc pas inclus ici.
 */
export function deriveRentalIncidents(rentals: Rental[]): RentalIncident[] {
  const incidents: RentalIncident[] = [];

  for (const rental of rentals) {
    if (rental.statut === 'annulee') {
      incidents.push({ rentalId: rental.id, type: 'annulee' });
    }
    if (rental.dateRetourReel && rental.dateRetourReel > rental.dateFinPrevue) {
      incidents.push({ rentalId: rental.id, type: 'retard' });
    }
  }

  return incidents;
}

import type { Rental } from '@/features/rentals/types';

export type FleetHref = { pathname: string; params?: Record<string, string> };

/** Dernière location terminée d'un véhicule (retour réel le plus récent), ou null. */
export function lastReturnedRental(vehicleId: string, rentals: Rental[]): Rental | null {
  let best: Rental | null = null;
  for (const rental of rentals) {
    if (rental.vehicleId !== vehicleId || rental.statut !== 'terminee' || !rental.dateRetourReel) continue;
    if (!best || new Date(rental.dateRetourReel).getTime() > new Date(best.dateRetourReel as string).getTime()) best = rental;
  }
  return best;
}

/** « Inspecter » : l'inspection de retour de la dernière location terminée ; sans location, la fiche du véhicule. */
export function inspectionHref(vehicleId: string, rentals: Rental[]): FleetHref {
  const last = lastReturnedRental(vehicleId, rentals);
  return last ? { pathname: '/locations/[id]/inspection-retour', params: { id: last.id } } : { pathname: '/flotte/[id]', params: { id: vehicleId } };
}

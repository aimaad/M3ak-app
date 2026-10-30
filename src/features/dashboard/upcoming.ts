import type { Rental, RentalStatus } from '@/features/rentals/types';

/** Locations pas encore commencées (réservées, confirmées ou en attente de confirmation). */
export const UPCOMING_STATUSES: RentalStatus[] = ['en_attente_confirmation', 'reservee', 'confirmee'];

/**
 * Prochaines locations à partir d'aujourd'hui (début de la journée, heure locale), la plus proche d'abord. Une location
 * qui commence plus tard dans la journée compte ; une location passée ou annulée non. Sans accès aux données : liste vide.
 */
export function upcomingRentals(rentals: readonly Rental[], now: Date, limit: number): Rental[] {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return rentals
    .filter((rental) => UPCOMING_STATUSES.includes(rental.statut) && new Date(rental.dateDebutPrevue).getTime() >= startOfToday)
    .sort((a, b) => new Date(a.dateDebutPrevue).getTime() - new Date(b.dateDebutPrevue).getTime())
    .slice(0, Math.max(0, limit));
}

import type { RentalStatus } from './types';

/**
 * Graphe explicite des transitions autorisées. "reservee" est l'ancien statut
 * (avant l'introduction de la confirmation) : on le traite comme équivalent
 * à "confirmee" pour les réservations déjà existantes, sans jamais plus
 * l'attribuer à une nouvelle réservation.
 */
const ALLOWED_TRANSITIONS: Record<RentalStatus, RentalStatus[]> = {
  en_attente_confirmation: ['confirmee', 'annulee'],
  confirmee: ['en_cours', 'annulee'],
  reservee: ['en_cours', 'annulee'],
  en_cours: ['terminee'],
  terminee: [],
  annulee: [],
};

export function canTransitionRentalStatus(current: RentalStatus, next: RentalStatus): boolean {
  if (current === next) return false;
  return ALLOWED_TRANSITIONS[current].includes(next);
}

/**
 * Statuts qui bloquent la disponibilité du véhicule (voir availability.ts) : une voiture promise, même en attente de
 * confirmation, ne peut pas être promise à un autre client sur le même créneau (règle serveur : migration 0056).
 */
export const BLOCKING_RENTAL_STATUSES: RentalStatus[] = ['en_attente_confirmation', 'reservee', 'confirmee', 'en_cours'];

/** Statuts terminaux : plus aucune transition possible. */
export function isTerminalRentalStatus(status: RentalStatus): boolean {
  return ALLOWED_TRANSITIONS[status].length === 0;
}

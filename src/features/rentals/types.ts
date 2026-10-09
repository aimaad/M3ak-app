export type RentalStatus =
  | 'en_attente_confirmation'
  | 'confirmee'
  | 'reservee'
  | 'en_cours'
  | 'terminee'
  | 'annulee';

export const RENTAL_STATUSES: RentalStatus[] = [
  'en_attente_confirmation',
  'confirmee',
  'en_cours',
  'terminee',
  'annulee',
];

/** "reservee" est l'ancien statut, conservé pour les données existantes mais
 * jamais plus attribué à une nouvelle réservation — exclu des listes/filtres
 * visibles pour ne pas dérouter l'utilisateur, mais toujours reconnu partout
 * où un statut est traité (badge, disponibilité, transitions — voir
 * BLOCKING_RENTAL_STATUSES dans status-transitions.ts). */

export type PaymentStatus = 'non_paye' | 'acompte_verse' | 'paye_integralement';
export const PAYMENT_STATUSES: PaymentStatus[] = ['non_paye', 'acompte_verse', 'paye_integralement'];

export type Rental = {
  id: string;
  agencyId: string;
  numero: string;
  vehicleId: string;
  customerId: string;
  driverId: string | null;
  branchDepartId: string | null;
  branchRetourId: string | null;
  lieuDepart: string | null;
  lieuRetour: string | null;
  statut: RentalStatus;
  dateDebutPrevue: string;
  dateFinPrevue: string;
  dateDepartReel: string | null;
  dateRetourReel: string | null;
  kmDepart: number | null;
  kmRetour: number | null;
  carburantDepart: number | null;
  carburantRetour: number | null;
  dureeJours: number | null;
  prixJourApplique: number | null;
  sousTotal: number | null;
  fraisSupplementaires: number;
  remiseMontant: number;
  prixTotal: number | null;
  devise: string;
  acomptePrevu: number;
  acomptePaye: number;
  statutPaiement: PaymentStatus;
  cautionMontant: number;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RentalInput = {
  vehicleId: string;
  customerId: string;
  driverId: string | null;
  branchDepartId: string | null;
  branchRetourId: string | null;
  lieuDepart: string | null;
  lieuRetour: string | null;
  dateDebutPrevue: string;
  dateFinPrevue: string;
  fraisSupplementaires: number;
  remiseMontant: number;
  acomptePrevu: number;
  cautionMontant: number;
  notes: string | null;
  /** 'en_attente_confirmation' (par défaut) ou 'confirmee' si l'agence
   * confirme immédiatement à la création. Le prix n'est volontairement pas
   * un champ de cette entrée : il est calculé et figé côté serveur à partir
   * des tarifs réels du véhicule (déclencheur compute_rental_price,
   * migration 0013), jamais à partir d'une valeur envoyée par le client. */
  statutInitial: 'en_attente_confirmation' | 'confirmee';
};

export type DepartInput = {
  kmDepart: number;
  carburantDepart: number;
};

export type RetourInput = {
  kmRetour: number;
  carburantRetour: number;
};

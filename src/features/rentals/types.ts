export type RentalStatus = 'reservee' | 'en_cours' | 'terminee' | 'annulee';

export const RENTAL_STATUSES: RentalStatus[] = ['reservee', 'en_cours', 'terminee', 'annulee'];

export const ACTIVE_RENTAL_STATUSES: RentalStatus[] = ['reservee', 'en_cours'];

export type Rental = {
  id: string;
  agencyId: string;
  vehicleId: string;
  customerId: string;
  statut: RentalStatus;
  dateDebutPrevue: string;
  dateFinPrevue: string;
  dateDepartReel: string | null;
  dateRetourReel: string | null;
  kmDepart: number | null;
  kmRetour: number | null;
  carburantDepart: number | null;
  carburantRetour: number | null;
  prixTotal: number | null;
  cautionMontant: number;
  createdAt: string;
};

export type RentalInput = {
  vehicleId: string;
  customerId: string;
  dateDebutPrevue: string;
  dateFinPrevue: string;
  prixTotal: number | null;
  cautionMontant: number;
};

export type DepartInput = {
  kmDepart: number;
  carburantDepart: number;
};

export type RetourInput = {
  kmRetour: number;
  carburantRetour: number;
};

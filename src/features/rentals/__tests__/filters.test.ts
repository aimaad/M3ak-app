import { countRentalsByStatus, filterRentalsByStatus } from '../filters';
import type { Rental } from '../types';

function makeRental(overrides: Partial<Rental>): Rental {
  return {
    id: '1',
    agencyId: 'agency-1',
    numero: 'RES-2026-00001',
    vehicleId: 'vehicle-1',
    customerId: 'customer-1',
    driverId: null,
    branchDepartId: null,
    branchRetourId: null,
    lieuDepart: null,
    lieuRetour: null,
    statut: 'confirmee',
    dateDebutPrevue: '2026-03-10T09:00:00.000Z',
    dateFinPrevue: '2026-03-15T09:00:00.000Z',
    dateDepartReel: null,
    dateRetourReel: null,
    kmDepart: null,
    kmRetour: null,
    carburantDepart: null,
    carburantRetour: null,
    dureeJours: 5,
    prixJourApplique: 300,
    sousTotal: 1500,
    fraisSupplementaires: 0,
    remiseMontant: 0,
    prixTotal: 1500,
    devise: 'MAD',
    acomptePrevu: 0,
    acomptePaye: 0,
    statutPaiement: 'non_paye',
    cautionMontant: 2000,
    notes: null,
    createdBy: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('filterRentalsByStatus', () => {
  const rentals = [
    makeRental({ id: '1', statut: 'confirmee' }),
    makeRental({ id: '2', statut: 'en_cours' }),
    makeRental({ id: '3', statut: 'terminee' }),
  ];

  it("renvoie tout pour 'tous'", () => {
    expect(filterRentalsByStatus(rentals, 'tous')).toHaveLength(3);
  });

  it('filtre par statut', () => {
    expect(filterRentalsByStatus(rentals, 'en_cours').map((r) => r.id)).toEqual(['2']);
  });
});

describe('countRentalsByStatus', () => {
  it('compte chaque statut et le total, y compris l’ancien statut "reservee"', () => {
    const rentals = [
      makeRental({ id: '1', statut: 'en_attente_confirmation' }),
      makeRental({ id: '2', statut: 'confirmee' }),
      makeRental({ id: '3', statut: 'en_cours' }),
      makeRental({ id: '4', statut: 'terminee' }),
      makeRental({ id: '5', statut: 'annulee' }),
      makeRental({ id: '6', statut: 'reservee' }),
    ];
    expect(countRentalsByStatus(rentals)).toEqual({
      tous: 6,
      en_attente_confirmation: 1,
      confirmee: 1,
      reservee: 1,
      en_cours: 1,
      terminee: 1,
      annulee: 1,
    });
  });
});

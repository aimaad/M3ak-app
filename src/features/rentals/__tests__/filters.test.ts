import { countRentalsByStatus, filterRentalsByStatus } from '../filters';
import type { Rental } from '../types';

function makeRental(overrides: Partial<Rental>): Rental {
  return {
    id: '1',
    agencyId: 'agency-1',
    vehicleId: 'vehicle-1',
    customerId: 'customer-1',
    statut: 'reservee',
    dateDebutPrevue: '2026-03-10',
    dateFinPrevue: '2026-03-15',
    dateDepartReel: null,
    dateRetourReel: null,
    kmDepart: null,
    kmRetour: null,
    carburantDepart: null,
    carburantRetour: null,
    prixTotal: 1500,
    cautionMontant: 2000,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('filterRentalsByStatus', () => {
  const rentals = [
    makeRental({ id: '1', statut: 'reservee' }),
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
  it('compte chaque statut et le total', () => {
    const rentals = [
      makeRental({ id: '1', statut: 'reservee' }),
      makeRental({ id: '2', statut: 'reservee' }),
      makeRental({ id: '3', statut: 'en_cours' }),
      makeRental({ id: '4', statut: 'terminee' }),
      makeRental({ id: '5', statut: 'annulee' }),
    ];
    expect(countRentalsByStatus(rentals)).toEqual({
      tous: 5,
      reservee: 2,
      en_cours: 1,
      terminee: 1,
      annulee: 1,
    });
  });
});

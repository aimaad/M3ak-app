import { deriveRentalIncidents } from '../incidents';
import type { Rental } from '../types';

function buildRental(overrides: Partial<Rental> = {}): Rental {
  return {
    id: 'r1',
    agencyId: 'a1',
    numero: 'RES-1',
    vehicleId: 'v1',
    customerId: 'c1',
    driverId: null,
    branchDepartId: null,
    branchRetourId: null,
    lieuDepart: null,
    lieuRetour: null,
    statut: 'terminee',
    dateDebutPrevue: '2026-06-01T09:00:00Z',
    dateFinPrevue: '2026-06-03T09:00:00Z',
    dateDepartReel: '2026-06-01T09:00:00Z',
    dateRetourReel: null,
    kmDepart: null,
    kmRetour: null,
    carburantDepart: null,
    carburantRetour: null,
    dureeJours: 2,
    prixJourApplique: 200,
    sousTotal: 400,
    fraisSupplementaires: 0,
    remiseMontant: 0,
    prixTotal: 400,
    devise: 'MAD',
    acomptePrevu: 0,
    acomptePaye: 0,
    statutPaiement: 'non_paye',
    cautionMontant: 500,
    notes: null,
    createdBy: null,
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
    ...overrides,
  };
}

describe('deriveRentalIncidents', () => {
  it('ne signale rien pour une location terminée à l\'heure', () => {
    const rental = buildRental({ dateRetourReel: '2026-06-03T08:00:00Z' });
    expect(deriveRentalIncidents([rental])).toEqual([]);
  });

  it('signale un retard quand le retour réel dépasse la fin prévue', () => {
    const rental = buildRental({ dateRetourReel: '2026-06-03T15:00:00Z' });
    expect(deriveRentalIncidents([rental])).toEqual([{ rentalId: 'r1', type: 'retard' }]);
  });

  it('signale une annulation', () => {
    const rental = buildRental({ statut: 'annulee', dateRetourReel: null });
    expect(deriveRentalIncidents([rental])).toEqual([{ rentalId: 'r1', type: 'annulee' }]);
  });
});

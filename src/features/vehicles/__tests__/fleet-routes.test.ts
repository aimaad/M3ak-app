import type { Rental } from '@/features/rentals/types';

import { inspectionHref, lastReturnedRental } from '../fleet-routes';

const rental = (id: string, vehicleId: string, statut: Rental['statut'], retour: string | null) => ({ id, vehicleId, statut, dateRetourReel: retour }) as Rental;

describe('« Inspecter » : où aller', () => {
  const rentals = [
    rental('ancienne', 'v1', 'terminee', '2030-06-01T10:00:00Z'),
    rental('recente', 'v1', 'terminee', '2030-06-05T10:00:00Z'),
    rental('en-cours', 'v1', 'en_cours', null),
    rental('autre', 'v2', 'terminee', '2030-06-09T10:00:00Z'),
  ];

  it('prend la dernière location terminée du véhicule (retour réel le plus récent)', () => {
    expect(lastReturnedRental('v1', rentals)?.id).toBe('recente');
    expect(inspectionHref('v1', rentals)).toEqual({ pathname: '/locations/[id]/inspection-retour', params: { id: 'recente' } });
  });

  it('sans location terminée : la fiche du véhicule', () => {
    expect(lastReturnedRental('v3', rentals)).toBeNull();
    expect(inspectionHref('v3', rentals)).toEqual({ pathname: '/flotte/[id]', params: { id: 'v3' } });
    expect(inspectionHref('v1', [rental('r', 'v1', 'en_cours', null)])).toEqual({ pathname: '/flotte/[id]', params: { id: 'v1' } });
  });
});

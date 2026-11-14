/* eslint-disable import/first -- les « jest.mock » doivent précéder les imports */
const mockUpdate = jest.fn();
jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    from: () => ({ update: (row: unknown) => { mockUpdate(row); return { eq: () => ({ select: () => ({ single: async () => ({ data: { id: 'v1', photos: [], documents: [] }, error: null }) }) }) }; } }),
  }),
}));
jest.mock('@/features/storage/api', () => ({ uploadFile: jest.fn(), uploadFileWithProgress: jest.fn() }));
jest.mock('expo-image-manipulator', () => ({}));

import { updateVehicle } from '../api';
import type { VehicleInput } from '../types';

const input = { marque: 'Dacia', modele: 'Logan', immatriculation: '1', vin: null, finition: null, annee: 2021, categorie: null, couleur: 'Gris', nombrePlaces: 5, transmission: null, carburant: 'diesel', kilometrage: 1, niveauCarburant: null, statut: 'disponible', prixJour: 500, prixSemaine: null, prixMois: null, description: null } as unknown as VehicleInput;

describe('updateVehicle', () => {
  beforeEach(() => mockUpdate.mockClear());

  it('statut manuel : le statut est enregistré avec le reste', async () => {
    await updateVehicle('v1', { ...input, statut: 'maintenance' });
    expect(mockUpdate.mock.calls[0][0]).toMatchObject({ statut: 'maintenance', couleur: 'Gris' });
  });

  it('véhicule en location ou à inspecter : l’enregistrement réussit, le statut n’est PAS envoyé (jamais écrasé à la main)', async () => {
    for (const statut of ['en_location', 'a_inspecter'] as const) {
      await expect(updateVehicle('v1', { ...input, statut })).resolves.toBeDefined();
      expect(mockUpdate.mock.calls.at(-1)?.[0]).not.toHaveProperty('statut');
      expect(mockUpdate.mock.calls.at(-1)?.[0]).toMatchObject({ couleur: 'Gris' });
    }
  });
});

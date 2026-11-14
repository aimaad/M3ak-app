/* eslint-disable import/first -- les « jest.mock » doivent précéder les imports */
const mockInserted: unknown[] = [];
const mockUpdated: unknown[] = [];
const mockChain = { select: () => mockChain, single: async () => ({ data: { id: 'm1', agency_id: 'a', vehicle_id: 'v', type: 'vidange', statut: 'a_venir', created_at: '2026-01-01' }, error: null }), eq: () => mockChain, in: () => mockChain };

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));
jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({ from: () => ({ insert: (row: unknown) => { mockInserted.push(row); return mockChain; }, update: (row: unknown) => { mockUpdated.push(row); return mockChain; } }) }),
}));
jest.mock('@/features/storage/api', () => ({ uploadFile: jest.fn() }));

import { createMaintenanceItem, updateMaintenanceDue } from '../api';

const base = { vehicleId: 'v', type: 'vidange' as const, echeanceDate: null, echeanceKm: 70000, notes: null };

describe('payload des échéances (la périodicité n’est envoyée que si elle est réglée)', () => {
  beforeEach(() => {
    mockInserted.length = 0;
    mockUpdated.length = 0;
  });

  it('échéance ponctuelle : aucune colonne de périodicité (marche même si la migration 0071 manque)', async () => {
    await createMaintenanceItem('a', base);
    expect(mockInserted[0]).not.toHaveProperty('repeat_km');
    expect(mockInserted[0]).not.toHaveProperty('repeat_months');
    await createMaintenanceItem('a', { ...base, repeatKm: null, repeatMonths: null });
    expect(mockInserted[1]).not.toHaveProperty('repeat_km');
  });

  it('échéance périodique : les deux colonnes sont envoyées', async () => {
    await createMaintenanceItem('a', { ...base, repeatKm: 10000, repeatMonths: 12 });
    expect(mockInserted[0]).toMatchObject({ repeat_km: 10000, repeat_months: 12 });
  });

  it('modification : « pas de périodicité » (null) l’efface, « non précisé » (absent) ne touche à rien', async () => {
    await updateMaintenanceDue('m1', { echeanceDate: null, echeanceKm: 1, notes: null, repeatKm: null, repeatMonths: 6 });
    expect(mockUpdated[0]).toMatchObject({ repeat_km: null, repeat_months: 6 });
    await updateMaintenanceDue('m1', { echeanceDate: null, echeanceKm: 1, notes: null });
    expect(mockUpdated[1]).not.toHaveProperty('repeat_km');
  });
});

/* eslint-disable import/first -- les « jest.mock » doivent précéder les imports */
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Alert } from 'react-native';

import fr from '@/i18n/locales/fr.json';

const mockLookup = (dict: unknown, key: string): string => key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], dict) as string;
const mockTranslate = (key: string, options?: Record<string, unknown>) => (mockLookup(fr, key) ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => String(options?.[name] ?? ''));
const mockState = { conflicts: [] as unknown[], checkFails: false, started: [] as string[] };

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() }, useLocalSearchParams: () => ({ id: 'm1' }) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: React.ReactNode }) => children, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@/components/document-photo-field', () => ({ DocumentPhotoField: () => null }));
jest.mock('@/components/document-preview', () => ({ DocumentPreview: () => null }));
jest.mock('@/features/agency/hooks', () => ({ useMyAgency: () => ({ data: { agencyId: 'a1', role: 'owner' } }) }));
jest.mock('@/features/vehicles/hooks', () => ({ useVehicle: () => ({ data: { id: 'v1', marque: 'DACIA', modele: 'LOGAN', immatriculation: '1-A-1' } }) }));
jest.mock('@/features/maintenance/api', () => ({ MAINTENANCE_DOCUMENTS_BUCKET: 'm', uploadMaintenanceInvoice: jest.fn() }));
jest.mock('@/i18n/use-language', () => ({ useLanguage: () => ({ language: 'fr', t: mockTranslate }) }));
jest.mock('@/features/maintenance/hooks', () => ({
  useMaintenanceItem: () => ({ data: { id: 'm1', vehicleId: 'v1', type: 'vidange', statut: 'a_venir', echeanceDate: null, echeanceKm: 50000, facturePath: null }, isLoading: false, isError: false }),
  useStartMaintenanceItem: () => ({ isPending: false, mutate: (id: string) => mockState.started.push(id) }),
  useCompleteMaintenanceItem: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useCheckMaintenanceConflicts: () => ({ isPending: false, mutateAsync: async () => { if (mockState.checkFails) throw new Error('offline'); return mockState.conflicts; } }),
}));

import MaintenanceDetailScreen from '@/app/maintenance/[id]/index';

describe('« Démarrer l’intervention » : vérification des locations en cours', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    Object.assign(mockState, { conflicts: [], checkFails: false, started: [] });
  });

  it('aucune location : démarre directement, sans question', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await render(<MaintenanceDetailScreen />);
    await fireEvent.press(screen.getByText("Démarrer l'intervention"));
    await screen.findByText("Démarrer l'intervention");
    expect(alert).not.toHaveBeenCalled();
    expect(mockState.started).toEqual(['m1']);
  });

  it('location en cours : avertissement avec le client ; « Démarrer quand même » démarre (jamais bloquant)', async () => {
    mockState.conflicts = [{ rentalId: 'r1', customer: 'Karim Alami', statut: 'en_cours', start: 'x', end: 'y' }];
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await render(<MaintenanceDetailScreen />);
    await fireEvent.press(screen.getByText("Démarrer l'intervention"));
    await screen.findByText("Démarrer l'intervention");
    expect(alert).toHaveBeenCalledWith('Une location est en cours', expect.stringContaining('Karim A.'), expect.any(Array));
    expect(mockState.started).toEqual([]); // rien avant votre choix
    (alert.mock.calls[0][2] as { text: string; onPress?: () => void }[]).find((button) => button.text === 'Démarrer quand même')?.onPress?.();
    expect(mockState.started).toEqual(['m1']);
  });

  it('la vérification échoue (hors ligne…) : on démarre quand même', async () => {
    mockState.checkFails = true;
    await render(<MaintenanceDetailScreen />);
    await fireEvent.press(screen.getByText("Démarrer l'intervention"));
    await screen.findByText("Démarrer l'intervention");
    expect(mockState.started).toEqual(['m1']);
  });
});

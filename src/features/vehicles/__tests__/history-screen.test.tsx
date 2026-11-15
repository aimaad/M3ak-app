/* eslint-disable import/first -- les « jest.mock » doivent précéder les imports */
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import fr from '@/i18n/locales/fr.json';

const lookup = (key: string): string => key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], fr) as string;
const translate = (key: string, options?: Record<string, unknown>) => (lookup(key) ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => String(options?.[name] ?? ''));

const mockState = { rentals: [] as unknown[] };
const mockRouter = { push: jest.fn(), back: jest.fn() };

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
  useLocalSearchParams: () => ({ id: 'v1' }),
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: React.ReactNode }) => children, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/components/screen-header', () => ({ ScreenHeader: () => null }));
jest.mock('@/i18n/use-language', () => ({ useLanguage: () => ({ language: 'fr', t: (key: string, options?: Record<string, unknown>) => translate(key, options) }) }));
jest.mock('@/features/vehicles/add/scan-parts', () => ({ ScanFrame: () => null }));
jest.mock('@/components/form/camera-capture', () => ({ CameraCapture: () => null }));
jest.mock('expo-image-manipulator', () => ({}));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(async () => undefined), ImpactFeedbackStyle: { Light: 'light' } }));
jest.mock('@/features/storage/hooks', () => ({ useSignedUrl: () => ({ data: undefined }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@/features/compliance/hooks', () => ({ useVehicleCompliance: () => ({ data: [] }) }));
jest.mock('@/features/inspections/hooks', () => ({ useVehicleInspections: () => ({ data: [], isLoading: false }) }));
jest.mock('@/features/vehicles/detail/use-vehicle-detail', () => ({
  useVehicleDetail: () => ({ isLoading: false, role: 'owner', rentals: mockState.rentals, maintenance: [], customers: new Map() }),
}));

import VehicleHistoryScreen from '../../../app/(tabs)/flotte/[id]/historique';

const rental = (index: number) => ({
  id: `r${index}`, vehicleId: 'v1', customerId: null, statut: 'terminee', dateDebutPrevue: new Date(2026, 0, index + 1).toISOString(), dateFinPrevue: new Date(2026, 0, index + 2).toISOString(),
  dateDepartReel: new Date(2026, 0, index + 1).toISOString(), dateRetourReel: new Date(2026, 0, index + 2).toISOString(), montantTotal: 100, numero: `RES-${index}`,
});

describe('historique du véhicule : pagination', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('peu d’événements : tout est affiché, pas de bouton « Afficher plus »', async () => {
    mockState.rentals = Array.from({ length: 5 }, (_, index) => rental(index));
    await render(<VehicleHistoryScreen />);
    expect(screen.getByText('5 sur 5 événements')).toBeTruthy();
    expect(screen.queryByLabelText(/^Afficher .* de plus$/)).toBeNull();
  });

  it('beaucoup d’événements : 15 d’abord, puis 15 de plus à chaque appui, jusqu’au bout', async () => {
    mockState.rentals = Array.from({ length: 40 }, (_, index) => rental(index));
    await render(<VehicleHistoryScreen />);
    expect(screen.getByText('15 sur 40 événements')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Afficher 15 de plus'));
    expect(screen.getByText('30 sur 40 événements')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Afficher 10 de plus')); // il n'en reste que 10
    expect(screen.getByText('40 sur 40 événements')).toBeTruthy();
    expect(screen.queryByLabelText(/^Afficher .* de plus$/)).toBeNull();
  });
});

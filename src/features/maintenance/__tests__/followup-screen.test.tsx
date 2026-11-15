/* eslint-disable import/first -- les « jest.mock » doivent précéder les imports */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import fr from '@/i18n/locales/fr.json';

const mockLookup = (dict: unknown, key: string): string => key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], dict) as string;
const mockTranslate = (key: string, options?: Record<string, unknown>) => (mockLookup(fr, key) ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => String(options?.[name] ?? ''));
const mockState = {
  item: null as Record<string, unknown> | null,
  role: 'owner',
  snoozed: [] as unknown[],
  snoozeError: null as unknown,
  quick: [] as unknown[],
  planned: [] as unknown[],
};
const mockRouter = { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: () => true };

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
  useLocalSearchParams: () => ({ id: 'm1' }),
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: React.ReactNode }) => children, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@react-native-community/datetimepicker', () => ({ __esModule: true, default: () => null, DateTimePickerAndroid: { open: jest.fn() } }));
jest.mock('expo-image-manipulator', () => ({}));
jest.mock('@/features/vehicles/add/scan-parts', () => ({ ScanFrame: () => null }));
jest.mock('@/components/form/camera-capture', () => ({ CameraCapture: () => null }));
jest.mock('@/components/form/photo-check', () => ({ checkPhoto: async () => ({ ok: true }) }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(async () => undefined), ImpactFeedbackStyle: { Light: 'light' } }));
jest.mock('@/i18n/use-language', () => ({ useLanguage: () => ({ language: 'fr', t: mockTranslate }) }));
jest.mock('@/features/agency/hooks', () => ({ useMyAgency: () => ({ data: { agencyId: 'a1', role: mockState.role } }) }));
jest.mock('@/features/vehicles/hooks', () => ({ useVehicle: () => ({ data: { id: 'v1', marque: 'DACIA', modele: 'LOGAN', immatriculation: '8921 | ب | 14', kilometrage: 48200 } }) }));
jest.mock('@/features/maintenance/hooks', () => ({
  useMaintenanceItem: () => ({ data: mockState.item, isLoading: false, isError: false }),
  useSnoozeMaintenanceFollowup: () => ({
    isPending: false,
    mutate: (args: unknown, options?: { onSuccess?: () => void; onError?: (error: unknown) => void }) => {
      if (mockState.snoozeError) return options?.onError?.(mockState.snoozeError);
      mockState.snoozed.push(args);
      options?.onSuccess?.();
    },
  }),
  usePlanMaintenance: () => ({ isPending: false, mutate: (args: unknown, options?: { onSuccess?: () => void }) => { mockState.planned.push(args); options?.onSuccess?.(); } }),
  useCheckMaintenanceConflicts: () => ({ isPending: false, mutateAsync: async () => [] }),
  useQuickCompleteMaintenance: () => ({ isPending: false, mutate: (args: unknown, options?: { onSuccess?: () => void }) => { mockState.quick.push(args); options?.onSuccess?.(); } }),
}));

import MaintenanceFollowupScreen from '@/app/maintenance/[id]/suivi';

const open = (extra: Record<string, unknown> = {}) => ({ id: 'm1', vehicleId: 'v1', type: 'vidange', statut: 'a_venir', echeanceDate: '2026-11-16', echeanceKm: 49000, ...extra });

describe('réponse « Avez-vous fait … ? »', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(mockState, { item: open(), role: 'owner', snoozed: [], snoozeError: null, quick: [], planned: [] });
  });

  it('la question, la voiture et l’échéance (date OU kilométrage)', async () => {
    await render(<MaintenanceFollowupScreen />);
    expect(screen.getByText('Avez-vous fait la vidange ?')).toBeTruthy();
    expect(screen.getByText(/^Dacia Logan · 8921/)).toBeTruthy();
    expect(screen.getByText(/Échéance : le .+ ou à 49.?000 km/)).toBeTruthy();
  });

  it('« Oui, c’est fait » : la carte prérempli (km de la fiche, date du jour), un seul « Confirmer »', async () => {
    await render(<MaintenanceFollowupScreen />);
    await fireEvent.press(screen.getByLabelText("Oui, c'est fait"));
    expect(screen.getByDisplayValue('48 200')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Confirmer'));
    expect(mockState.quick).toEqual([{ id: 'm1', input: { km: 48200, date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), garage: null, cout: null } }]);
    expect(mockRouter.back).toHaveBeenCalled(); // on revient une fois fait
  });

  it('« Oui » : garage et coût restent facultatifs et jamais bloquants ; pas de coût pour l’employé', async () => {
    mockState.role = 'employee';
    await render(<MaintenanceFollowupScreen />);
    await fireEvent.press(screen.getByLabelText("Oui, c'est fait"));
    await fireEvent.press(screen.getByText('Ajouter des détails (garage, coût)'));
    expect(screen.queryByLabelText('Coût (MAD)')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Confirmer')); // rien rempli : ça passe
    expect(mockState.quick).toHaveLength(1);
  });

  it('« Pas encore » : on choisit quand rappeler ; « Demain » reporte d’un jour', async () => {
    await render(<MaintenanceFollowupScreen />);
    await fireEvent.press(screen.getByLabelText('Pas encore'));
    expect(screen.getByText('Quand vous le rappeler ?')).toBeTruthy();
    await fireEvent.press(screen.getByText('Demain'));
    expect(mockState.snoozed).toEqual([{ id: 'm1', days: 1 }]);
    expect(await screen.findByText('Noté. On vous le rappellera demain.')).toBeTruthy();
  });

  it('« Pas encore » : dans 3 jours et dans une semaine', async () => {
    await render(<MaintenanceFollowupScreen />);
    await fireEvent.press(screen.getByLabelText('Pas encore'));
    await fireEvent.press(screen.getByText('Dans une semaine'));
    expect(mockState.snoozed).toEqual([{ id: 'm1', days: 7 }]);
  });

  it('échec du report : la raison est dite', async () => {
    mockState.snoozeError = { message: 'permission denied' };
    await render(<MaintenanceFollowupScreen />);
    await fireEvent.press(screen.getByLabelText('Pas encore'));
    await fireEvent.press(screen.getByText('Demain'));
    expect(await screen.findByText(/Impossible de reporter le rappel\./)).toBeTruthy();
  });

  it('déjà fait : on le dit, aucune question', async () => {
    mockState.item = open({ statut: 'effectuee' });
    await render(<MaintenanceFollowupScreen />);
    expect(screen.getByText('Déjà fait ✓')).toBeTruthy();
    expect(screen.queryByLabelText("Oui, c'est fait")).toBeNull();
    await fireEvent.press(screen.getByLabelText('Fermer'));
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
  });

  it('« Ouvrir la voiture »', async () => {
    await render(<MaintenanceFollowupScreen />);
    await fireEvent.press(screen.getByText('Ouvrir la voiture'));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/flotte/[id]', params: { id: 'v1' } });
  });

  it('« Pas encore » propose aussi de planifier une date et une heure', async () => {
    await render(<MaintenanceFollowupScreen />);
    await fireEvent.press(screen.getByLabelText('Pas encore'));
    await fireEvent.press(screen.getByText('Planifier une date et une heure'));
    expect(screen.getByText('Planifier : Vidange')).toBeTruthy();
    expect(screen.getByLabelText(/^Date du rendez-vous/)).toBeTruthy();
  });
});

/* eslint-disable import/first -- les « jest.mock » doivent précéder les imports */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import fr from '@/i18n/locales/fr.json';

const mockLookup = (dict: unknown, key: string): string => key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], dict) as string;
const mockTranslate = (key: string, options?: Record<string, unknown>) => (mockLookup(fr, key) ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => String(options?.[name] ?? ''));
const mockState = { role: 'owner', rows: [] as unknown[], saved: [] as unknown[], loading: false };

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true } }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: React.ReactNode }) => children, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@react-native-community/datetimepicker', () => ({ __esModule: true, default: () => null, DateTimePickerAndroid: { open: jest.fn() } }));
jest.mock('expo-image-manipulator', () => ({}));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(async () => undefined), ImpactFeedbackStyle: { Light: 'light' } }));
jest.mock('@/features/vehicles/add/scan-parts', () => ({ ScanFrame: () => null }));
jest.mock('@/components/form/camera-capture', () => ({ CameraCapture: () => null }));
jest.mock('@/i18n/use-language', () => ({ useLanguage: () => ({ language: 'fr', t: mockTranslate }) }));
jest.mock('@/features/agency/hooks', () => ({ useMyAgency: () => ({ data: { agencyId: 'a1', role: mockState.role } }) }));
jest.mock('@/features/due-rules/hooks', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { mergeRules } = require('@/features/due-rules/logic');
  return {
    useDueRules: () => ({ isLoading: mockState.loading, rows: mockState.rows, rules: mergeRules(mockState.rows) }),
    useSaveDueRules: () => ({ isPending: false, mutate: (args: unknown, options?: { onSuccess?: () => void }) => { mockState.saved.push(args); options?.onSuccess?.(); } }),
  };
});

import DueRulesScreen from '../echeances';

describe('règles d’échéances de l’agence', () => {
  beforeEach(() => {
    Object.assign(mockState, { role: 'owner', rows: [], saved: [], loading: false });
  });

  it('valeurs proposées indiquées comme INDICATIVES ; vidange 10 000, freins 30 000, pneus 40 000 km', async () => {
    await render(<DueRulesScreen />);
    expect(screen.getByLabelText(/Valeurs indicatives\./)).toBeTruthy();
    expect(screen.getByLabelText(/préconisations du constructeur et l'état réel du véhicule priment/)).toBeTruthy();
    expect(screen.getByDisplayValue('10 000')).toBeTruthy();
    expect(screen.getByDisplayValue('30 000')).toBeTruthy();
    expect(screen.getByDisplayValue('40 000')).toBeTruthy();
    expect(screen.queryByLabelText('Enregistrer')).toBeNull(); // aucune modification : pas de barre
  });

  it('désactiver une règle puis enregistrer : une seule requête avec les règles modifiées', async () => {
    await render(<DueRulesScreen />);
    await fireEvent.press(screen.getByLabelText('Activer : Pneus'));
    expect(screen.getByText('1 modification')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Enregistrer'));
    await waitFor(() => expect(mockState.saved).toHaveLength(1));
    expect(mockState.saved[0]).toEqual({ agencyId: 'a1', rules: [{ kind: 'pneus', enabled: false, repeatKm: 40000, repeatMonths: null }] }); // la périodicité est gardée si on réactive
  });

  it('personnaliser la vidange (15 000 km et 12 mois)', async () => {
    await render(<DueRulesScreen />);
    await fireEvent.changeText(screen.getAllByLabelText('Tous les')[0], '15000');
    await fireEvent.changeText(screen.getAllByLabelText('Ou tous les')[0], '12');
    await fireEvent.press(screen.getByLabelText('Enregistrer'));
    expect(mockState.saved[0]).toEqual({ agencyId: 'a1', rules: [{ kind: 'vidange', enabled: true, repeatKm: 15000, repeatMonths: 12 }] });
  });

  it('valeur absurde : message, rien n’est enregistré', async () => {
    await render(<DueRulesScreen />);
    await fireEvent.changeText(screen.getAllByLabelText('Tous les')[0], '0');
    await fireEvent.press(screen.getByLabelText('Enregistrer'));
    expect(screen.getByText(/entre 1 et 1 000 000/)).toBeTruthy();
    expect(mockState.saved).toEqual([]);
  });

  it('une obligation (vignette) peut être désactivée : sans périodicité', async () => {
    await render(<DueRulesScreen />);
    await fireEvent.press(screen.getByLabelText('Activer : Vignette'));
    await fireEvent.press(screen.getByLabelText('Enregistrer'));
    expect(mockState.saved[0]).toEqual({ agencyId: 'a1', rules: [{ kind: 'vignette', enabled: false, repeatKm: null, repeatMonths: null }] });
  });

  it('un employé voit les règles sans pouvoir les modifier', async () => {
    mockState.role = 'employee';
    await render(<DueRulesScreen />);
    expect(screen.getAllByText(/Seuls le propriétaire et les responsables/).length).toBeGreaterThan(0);
    expect(screen.queryByLabelText('Activer : Pneus')).toBeNull();
    expect(screen.queryByLabelText('Enregistrer')).toBeNull();
  });
});

/* eslint-disable import/first, @typescript-eslint/no-require-imports -- les « jest.mock » doivent précéder les imports et utilisent require */
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import fr from '@/i18n/locales/fr.json';

const mockLookup = (key: string): string => key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], fr) as string;
const mockTranslate = (key: string, options?: Record<string, unknown>) => (mockLookup(key) ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => String(options?.[name] ?? ''));

const mockState = {
  availability: 'active' as 'active' | 'loading' | 'no_key',
  connected: true,
  scan: jest.fn(),
  drafts: [] as unknown[],
  picture: 0,
};
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
}));
jest.mock('expo-camera', () => {
  const React = require('react');
  const CameraView = React.forwardRef(function CameraView(_props: unknown, ref: React.Ref<unknown>) {
    React.useImperativeHandle(ref, () => ({
      takePictureAsync: async () => {
        mockState.picture += 1;
        return { uri: `file:///photo-${mockState.picture}.jpg` };
      },
    }));
    return null;
  });
  return { CameraView, useCameraPermissions: () => [{ granted: true, canAskAgain: true }, jest.fn()] };
});
jest.mock('expo-image-picker', () => ({ requestMediaLibraryPermissionsAsync: async () => ({ granted: true }), launchImageLibraryAsync: async () => ({ canceled: false, assets: [{ uri: 'file:///galerie.jpg' }] }) }));
jest.mock('expo-haptics', () => ({ impactAsync: async () => undefined, notificationAsync: async () => undefined, ImpactFeedbackStyle: { Light: 'light' }, NotificationFeedbackType: { Success: 'success' } }));
jest.mock('@react-native-community/netinfo', () => ({ useNetInfo: () => ({ isConnected: mockState.connected }) }));
jest.mock('@/features/ocr/hooks', () => ({ useOcrSettings: () => ({ availability: mockState.availability, agencyId: 'a1' }) }));
jest.mock('@/features/ocr/ocr-inactive-notice', () => ({ OcrInactiveNotice: () => null }));
jest.mock('@/features/vehicles/ocr', () => ({ ...jest.requireActual('@/features/vehicles/ocr'), scanVehicleDocuments: (...args: unknown[]) => mockState.scan(...args) }));
jest.mock('@/features/vehicles/creation-draft', () => ({ setVehicleCreationDraft: (draft: unknown) => mockState.drafts.push(draft) }));
jest.mock('@/i18n/use-language', () => ({ useLanguage: () => ({ language: 'fr', t: (key: string, o?: Record<string, unknown>) => mockTranslate(key, o) }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const value = (v: number) => ({ value: v });
  return { __esModule: true, default: { View, createAnimatedComponent: (c: unknown) => c }, useSharedValue: value, useAnimatedStyle: () => ({}), useReducedMotion: () => true, withTiming: (v: number) => v, withRepeat: (v: number) => v, withSequence: (v: number) => v, cancelAnimation: () => undefined, Easing: { inOut: () => undefined, quad: undefined } };
});

import { getScanSession } from '@/features/vehicles/add/scan-session';
import { normalizeVehicleFields } from '@/features/vehicles/ocr';

import ScannerCarteGriseScreen from '../../../app/(tabs)/flotte/nouveau/scan';

const field = (value: unknown, confidence = 'high') => ({ value, confidence });
const okResult = (patch: Record<string, unknown>) => ({ ok: true, fields: normalizeVehicleFields(patch) });

async function shootBoth() {
  await fireEvent.press(screen.getByLabelText('Photographier le recto'));
  await screen.findByText('Verso de la carte grise');
  await fireEvent.press(screen.getByLabelText('Photographier le verso'));
  await screen.findByText('Lire les 2 faces');
}

describe('scanner de la carte grise', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockState.availability = 'active';
    mockState.connected = true;
    mockState.drafts = [];
    mockState.picture = 0;
    mockState.scan = jest.fn();
  });

  it('n’affiche que des choses vraies : conseils fixes et déclencheur manuel (ni Auto/Manuel, ni zones, ni points de qualité)', async () => {
    await render(<ScannerCarteGriseScreen />);
    expect(screen.getByText('Placez la carte dans le cadre')).toBeTruthy();
    for (const tip of ['À plat', 'Sans reflet', 'Bien éclairé']) expect(screen.getByText(tip)).toBeTruthy();
    expect(screen.getByText('Recto de la carte grise')).toBeTruthy();
    expect(screen.getByText('FACE 1 SUR 2')).toBeTruthy();
    for (const absent of ['Auto', 'Manuel', 'Netteté', 'Lumière', 'Léger reflet', 'PLAQUE', 'MARQUE']) expect(screen.queryByText(absent)).toBeNull();
    expect(screen.queryByText(/zones repérées/)).toBeNull();
  });

  it('recto puis verso, puis « Lire les 2 faces » : UNE seule analyse sur les deux photos ensemble, un seul résultat, direction « Carte grise lue »', async () => {
    mockState.scan.mockResolvedValueOnce(okResult({ immatriculation: field('68013-ب-72'), marque: field('Dacia'), modele: field('Sandero'), carburant: field('diesel') }));
    await render(<ScannerCarteGriseScreen />);
    await shootBoth();
    await fireEvent.press(screen.getByText('Lire les 2 faces'));
    expect(mockState.scan).toHaveBeenCalledTimes(1); // pas une lecture par face : une seule, lancée une seule fois
    expect(mockState.scan.mock.calls[0][0]).toEqual(['file:///photo-1.jpg', 'file:///photo-2.jpg']); // recto puis verso, ensemble
    expect(mockRouter.replace).toHaveBeenCalledWith('/flotte/nouveau/carte-lue');
    // Le résultat unique réunit plaque (recto) et marque, modèle, carburant (verso)
    const session = getScanSession();
    expect(session?.merged.marque.value).toBe('Dacia');
    expect(session?.merged.immatriculation.value).toBe('68013 | ب | 72'); // déjà au format de l'app
    expect(session?.scans.map((item) => item.face)).toEqual(['recto', 'verso']);
    expect(session?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('le verso est facultatif : « Passer le verso » lit le recto seul, avec la même analyse', async () => {
    mockState.scan.mockResolvedValue(okResult({ immatriculation: field('68013-ب-72') }));
    await render(<ScannerCarteGriseScreen />);
    await fireEvent.press(screen.getByLabelText('Photographier le recto'));
    await fireEvent.press(await screen.findByText('Passer le verso'));
    expect(mockState.scan).toHaveBeenCalledTimes(1);
    expect(mockState.scan.mock.calls[0][0]).toEqual(['file:///photo-1.jpg']);
    expect(mockRouter.replace).toHaveBeenCalledWith('/flotte/nouveau/carte-lue');
    expect(getScanSession()?.scans).toHaveLength(1);
  });

  it('résultat vide sur les deux faces : traité comme une carte non lue, photos gardées', async () => {
    mockState.scan.mockResolvedValue(okResult({}));
    await render(<ScannerCarteGriseScreen />);
    await shootBoth();
    await fireEvent.press(screen.getByText('Lire les 2 faces'));
    expect(await screen.findByText('Carte non lue, reprenez la photo ou saisissez à la main.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Réessayer'));
    expect(mockState.scan).toHaveBeenCalledTimes(2);
    expect(mockState.scan.mock.calls[1][0]).toEqual(['file:///photo-1.jpg', 'file:///photo-2.jpg']);
  });

  it('photo illisible : message clair, photos gardées (réessayer relit les mêmes), saisie à la main possible', async () => {
    mockState.scan.mockResolvedValue({ ok: false, error: 'ocr_failed' });
    await render(<ScannerCarteGriseScreen />);
    await fireEvent.press(screen.getByLabelText('Photographier le recto'));
    await fireEvent.press(await screen.findByText('Passer le verso'));
    expect(await screen.findByText('Carte non lue, reprenez la photo ou saisissez à la main.')).toBeTruthy();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText('Réessayer'));
    expect(mockState.scan).toHaveBeenCalledTimes(2);
    expect(mockState.scan.mock.calls[1][0]).toEqual(['file:///photo-1.jpg']); // la photo n'a pas été perdue
    await fireEvent.press(await screen.findByText('Saisir à la main'));
    expect(mockRouter.replace).toHaveBeenCalledWith('/flotte/nouveau/finaliser');
    expect(mockState.drafts.at(-1)).toMatchObject({ source: 'manual' });
  });

  it('hors connexion : message clair et lecture impossible, les photos restent à l’écran', async () => {
    mockState.connected = false;
    await render(<ScannerCarteGriseScreen />);
    await fireEvent.press(screen.getByLabelText('Photographier le recto'));
    expect(screen.getByText(/Pas de connexion/)).toBeTruthy();
    await fireEvent.press(await screen.findByText('Passer le verso'));
    expect(mockState.scan).not.toHaveBeenCalled();
  });

  it('lecture non active : propose la saisie à la main', async () => {
    mockState.availability = 'no_key';
    await render(<ScannerCarteGriseScreen />);
    await fireEvent.press(screen.getByText('Saisir à la main'));
    expect(mockRouter.replace).toHaveBeenCalledWith('/flotte/nouveau/finaliser');
  });

  it('« En savoir plus » ouvre le texte légal entier', async () => {
    await render(<ScannerCarteGriseScreen />);
    await fireEvent.press(screen.getByText('En savoir plus'));
    expect(await screen.findByText(/Votre entreprise a activé l'analyse par Google Gemini/)).toBeTruthy();
  });

  it('galerie : importe la photo de la face en cours', async () => {
    await render(<ScannerCarteGriseScreen />);
    await fireEvent.press(screen.getByLabelText('Importer depuis la galerie'));
    expect(await screen.findByText('Verso de la carte grise')).toBeTruthy();
  });
});

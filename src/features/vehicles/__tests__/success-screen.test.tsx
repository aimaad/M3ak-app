/* eslint-disable import/first, @typescript-eslint/no-require-imports -- les « jest.mock » doivent précéder les imports et utilisent require */
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import fr from '@/i18n/locales/fr.json';

const mockLookup = (key: string): string => key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], fr) as string;
const mockTranslate = (key: string, options?: Record<string, unknown>) => (mockLookup(key) ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => String(options?.[name] ?? ''));
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
  Redirect: ({ href }: { href: string }) => {
    const { Text } = require('react-native');
    return <Text>{`redirect:${href}`}</Text>;
  },
}));
jest.mock('@/features/storage/hooks', () => ({ useSignedUrl: () => ({ data: undefined }) }));
jest.mock('@/features/vehicles/api', () => ({ VEHICLE_PHOTOS_BUCKET: 'vehicle-photos' }));
jest.mock('@/i18n/use-language', () => ({ useLanguage: () => ({ language: 'fr', t: (key: string, o?: Record<string, unknown>) => mockTranslate(key, o) }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: { View, createAnimatedComponent: (c: unknown) => c }, useSharedValue: (v: number) => ({ value: v }), useAnimatedStyle: () => ({}), useReducedMotion: () => true, withSpring: (v: number) => v };
});

import { setCreatedVehicle } from '@/features/vehicles/add/created';
import type { MissingKey } from '@/features/vehicles/add/finalize';

import VehiculeAjouteScreen from '../../../app/(tabs)/flotte/nouveau/succes';

const vehicle = (extra: Record<string, unknown> = {}) => ({ id: 'v1', marque: 'Dacia', modele: 'Sandero', immatriculation: '68013 | ب | 72', categorie: 'suv', carburant: 'diesel', transmission: 'manuelle', statut: 'disponible', prixJour: 400, photos: [], documents: [], ...extra });
const open = (v: Record<string, unknown>, missing: MissingKey[]) => setCreatedVehicle({ vehicle: v as never, missing });

describe('écran « Véhicule ajouté »', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setCreatedVehicle(null);
  });

  it('disponible avec un prix : titre, sous-titre, carte du véhicule, « Louer maintenant » vers une nouvelle location préremplie', async () => {
    open(vehicle(), []);
    await render(<VehiculeAjouteScreen />);
    expect(screen.getByText('Dacia Sandero ajoutée à votre flotte')).toBeTruthy();
    expect(screen.getByText('Elle est disponible dès maintenant.')).toBeTruthy();
    expect(screen.getByText('SUV · Diesel · Manuelle')).toBeTruthy();
    expect(screen.getByText('Disponible')).toBeTruthy();
    expect(screen.queryByText(/À compléter/)).toBeNull();
    await fireEvent.press(screen.getByText('Louer maintenant'));
    expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/locations/nouveau', params: { vehicleId: 'v1', date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) } });
  });

  it('« À compléter plus tard » liste ce qui manque et « Compléter » ouvre la fiche', async () => {
    open(vehicle(), ['km', 'photo', 'assurance']);
    await render(<VehiculeAjouteScreen />);
    expect(screen.getByText(/À compléter plus tard :/)).toBeTruthy();
    expect(screen.getByText(/kilométrage, photo de face et date d'assurance/)).toBeTruthy();
    await fireEvent.press(screen.getByText('Compléter'));
    expect(mockRouter.push).toHaveBeenCalledWith('/flotte/v1');
  });

  it('en préparation : pas de « Louer maintenant » et le sous-titre le dit', async () => {
    open(vehicle({ statut: 'en_preparation' }), []);
    await render(<VehiculeAjouteScreen />);
    expect(screen.getByText('Elle est en préparation.')).toBeTruthy();
    expect(screen.getByText('En préparation')).toBeTruthy();
    expect(screen.queryByText('Louer maintenant')).toBeNull();
  });

  it('créé par un employé (prix à 0) : « À compléter : prix (propriétaire) », pas de « Louer maintenant »', async () => {
    open(vehicle({ prixJour: 0 }), ['price']);
    await render(<VehiculeAjouteScreen />);
    expect(screen.getByText(/À compléter :/)).toBeTruthy();
    expect(screen.getByText('prix (propriétaire)')).toBeTruthy();
    expect(screen.queryByText('Louer maintenant')).toBeNull();
  });

  it('« Ajouter un autre » retourne au choix ; « Voir dans Ma flotte » à la flotte', async () => {
    open(vehicle(), []);
    await render(<VehiculeAjouteScreen />);
    await fireEvent.press(screen.getByText('Ajouter un autre'));
    expect(mockRouter.replace).toHaveBeenCalledWith('/flotte/nouveau');
    await fireEvent.press(screen.getByText('Voir dans Ma flotte'));
    expect(mockRouter.replace).toHaveBeenCalledWith('/flotte');
  });

  it('ouvert sans véhicule ajouté : retour à Ma Flotte', async () => {
    await render(<VehiculeAjouteScreen />);
    expect(screen.getByText('redirect:/flotte')).toBeTruthy();
  });
});

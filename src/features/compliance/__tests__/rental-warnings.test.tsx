/* eslint-disable import/first -- les « jest.mock » doivent précéder les imports */
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import fr from '@/i18n/locales/fr.json';

const mockLookup = (key: string): string => key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], fr) as string;
const mockT = (key: string, options?: Record<string, unknown>) => (mockLookup(key) ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => String(options?.[name] ?? ''));
const mockState = { records: [] as unknown[], loaded: true };
const mockRouter = { push: jest.fn() };

jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@/features/vehicles/hooks', () => ({ useVehicle: () => ({ data: mockState.loaded ? { id: 'v1', dateMiseEnCirculation: null } : undefined }) }));
jest.mock('../hooks', () => ({ useVehicleCompliance: () => ({ data: mockState.loaded ? mockState.records : undefined }) }));
jest.mock('@/i18n/use-language', () => ({ useLanguage: () => ({ language: 'fr', t: mockT }) }));

import { RentalComplianceWarnings } from '../rental-warnings';

const day = (delta: number) => { const d = new Date(); d.setDate(d.getDate() + delta); d.setHours(12, 0, 0, 0); return d; };
const iso = (delta: number) => day(delta).toISOString();
const ymd = (delta: number) => iso(delta).slice(0, 10);
const rec = (kind: string, validUntil: string) => ({ id: kind, vehicleId: 'v1', kind, validFrom: null, validUntil, createdAt: '2026-01-01T00:00:00Z' });
const year = new Date().getFullYear();

describe('avertissements avant location', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(mockState, { records: [rec('assurance', ymd(400)), rec('visite_technique', ymd(400)), rec('vignette', `${year}-12-31`)], loaded: true });
  });

  it('tout est en règle : rien n’est affiché', async () => {
    await render(<RentalComplianceWarnings vehicleId="v1" start={iso(1)} end={iso(5)} />);
    expect(screen.queryByText('À vérifier avant de louer')).toBeNull();
  });

  it('données pas encore chargées ou période incomplète : rien (pas de faux avertissement)', async () => {
    mockState.loaded = false;
    await render(<RentalComplianceWarnings vehicleId="v1" start={iso(1)} end={iso(5)} />);
    expect(screen.queryByText('À vérifier avant de louer')).toBeNull();
  });

  it('période incomplète : rien', async () => {
    await render(<RentalComplianceWarnings vehicleId="v1" start={null} end={null} />);
    expect(screen.queryByText('À vérifier avant de louer')).toBeNull();
  });

  it('assurance expirée : avertissement avec la date, et la location reste possible (simple avertissement)', async () => {
    mockState.records = [rec('assurance', ymd(-3)), rec('visite_technique', ymd(400)), rec('vignette', `${year}-12-31`)];
    await render(<RentalComplianceWarnings vehicleId="v1" start={iso(1)} end={iso(5)} />);
    expect(screen.getByText('À vérifier avant de louer')).toBeTruthy();
    expect(screen.getByText(/^• Assurance expirée depuis le /)).toBeTruthy();
    expect(screen.getByText('Simple avertissement : la location reste possible.')).toBeTruthy();
  });

  it('visite qui expire pendant la location', async () => {
    mockState.records = [rec('assurance', ymd(400)), rec('visite_technique', ymd(3)), rec('vignette', `${year}-12-31`)];
    await render(<RentalComplianceWarnings vehicleId="v1" start={iso(1)} end={iso(5)} />);
    expect(screen.getByText(/^• La visite technique expire le .*, pendant la location\.$/)).toBeTruthy();
  });

  it('rien d’enregistré : « à vérifier » pour l’assurance et la visite', async () => {
    mockState.records = [];
    await render(<RentalComplianceWarnings vehicleId="v1" start={iso(1)} end={iso(5)} />);
    expect(screen.getByText("• Aucune assurance enregistrée : vérifiez qu'elle est valable.")).toBeTruthy();
    expect(screen.getByText("• Aucune visite technique enregistrée : vérifiez qu'elle est à jour.")).toBeTruthy();
  });

  it('« Ouvrir la fiche du véhicule »', async () => {
    mockState.records = [];
    await render(<RentalComplianceWarnings vehicleId="v1" start={iso(1)} end={iso(5)} />);
    await fireEvent.press(screen.getByText('Ouvrir la fiche du véhicule'));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/flotte/[id]', params: { id: 'v1' } });
  });
});

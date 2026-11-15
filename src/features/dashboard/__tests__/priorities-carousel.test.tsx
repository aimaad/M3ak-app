/* eslint-disable import/first -- les « jest.mock » doivent précéder les imports */
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import fr from '@/i18n/locales/fr.json';

const mockLookup = (dict: unknown, key: string): string => key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], dict) as string;
const mockTranslate = (key: string, options?: Record<string, unknown>) => (mockLookup(fr, key) ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => String(options?.[name] ?? ''));
const mockRouter = { push: jest.fn() };

jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
}));
jest.mock('@/i18n/use-language', () => ({ useLanguage: () => ({ language: 'fr', t: mockTranslate }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

import { PrioritiesSection } from '../priorities-carousel';

describe('accueil : carte « À régulariser »', () => {
  beforeEach(() => jest.clearAllMocks());

  it('carte rouge avec le nombre de véhicules ; un tap ouvre Ma Flotte filtrée', async () => {
    await render(<PrioritiesSection priorities={[{ kind: 'regularize', count: 3 }]} aiTime={null} />);
    expect(screen.getByText('À RÉGULARISER')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText(/véhicule\(s\) dont l'assurance ou la visite technique est expirée/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(/3 véhicule\(s\) dont l'assurance/));
    expect(mockRouter.push).toHaveBeenCalledWith('/flotte?regulariser=1');
  });

  it('rien à régulariser : pas de carte « À régulariser »', async () => {
    await render(<PrioritiesSection priorities={[]} aiTime={null} />);
    expect(screen.queryByText('À RÉGULARISER')).toBeNull();
  });
});

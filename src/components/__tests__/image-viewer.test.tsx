/* eslint-disable import/first -- les « jest.mock » doivent précéder les imports */
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import fr from '@/i18n/locales/fr.json';

const lookup = (key: string): string => key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], fr) as string;

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/i18n/use-language', () => ({ useLanguage: () => ({ language: 'fr', t: (key: string) => lookup(key) ?? key }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

import { ImageViewer } from '../image-viewer';

describe('visionneuse de photo (zoom)', () => {
  it('fermée : rien n’est affiché', async () => {
    await render(<ImageViewer uri={null} label="Assurance" onClose={jest.fn()} />);
    expect(screen.queryByLabelText('Agrandir')).toBeNull();
  });

  it('ouverte : agrandir jusqu’à 400 %, réduire, borné aux deux bouts', async () => {
    await render(<ImageViewer uri="file:///papier.jpg" label="Assurance" onClose={jest.fn()} />);
    expect(screen.getByText('100 %')).toBeTruthy();
    expect(screen.getByLabelText('Réduire').props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(screen.getByLabelText('Agrandir'));
    expect(screen.getByText('200 %')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Agrandir'));
    await fireEvent.press(screen.getByLabelText('Agrandir'));
    expect(screen.getByText('400 %')).toBeTruthy();
    expect(screen.getByLabelText('Agrandir').props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(screen.getByLabelText('Réduire'));
    expect(screen.getByText('300 %')).toBeTruthy();
  });

  it('« Fermer » ferme et remet le zoom à 100 %', async () => {
    const onClose = jest.fn();
    await render(<ImageViewer uri="file:///papier.jpg" label="Assurance" onClose={onClose} />);
    await fireEvent.press(screen.getByLabelText('Agrandir'));
    await fireEvent.press(screen.getAllByLabelText('Fermer')[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByText('100 %')).toBeTruthy();
  });
});

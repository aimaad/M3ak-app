import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { FleetWatchSection } from '../fleet-watch-section';
import type { WatchItem } from '../fleet-watch';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@/i18n/use-language', () => ({
  useLanguage: () => ({
    language: 'fr',
    t: (key: string, o?: Record<string, unknown>) => (o ? `${key}|${Object.values(o).join('|')}` : key),
  }),
}));

const item = (key: string, extra: Partial<WatchItem> = {}): WatchItem => ({
  key,
  vehicleId: `v-${key}`,
  vehicleName: 'Dacia Logan',
  source: 'document',
  type: 'assurance',
  icon: 'shield',
  urgency: 'normal',
  due: { kind: 'days', days: 12 },
  fill: 0.6,
  target: 'documents',
  score: 0.6,
  ...extra,
});

describe('« À surveiller »', () => {
  it('masqué s’il n’y a rien', async () => {
    await render(<FleetWatchSection items={[]} onOpen={jest.fn()} />);
    expect(screen.queryByText('flotte.watch.title')).toBeNull();
  });

  it('compteur, échéances (jours, kilomètres, dépassée) et libellé lu en une phrase', async () => {
    await render(
      <FleetWatchSection
        items={[item('a', { urgency: 'expired', due: { kind: 'expired' } }), item('b', { source: 'maintenance', type: 'vidange', icon: 'wrench', due: { kind: 'km', km: 500 }, urgency: 'hot', target: 'entretien' }), item('c')]}
        onOpen={jest.fn()}
      />
    );
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('flotte.watch.expired')).toBeTruthy();
    expect(screen.getByText('flotte.watch.dueKm|500')).toBeTruthy();
    expect(screen.getByText('flotte.watch.dueDays|12')).toBeTruthy();
    expect(screen.getByLabelText(/maintenance\.types\.vidange\|Dacia Logan/)).toBeTruthy();
  });

  it('un tap ouvre la section concernée ; « Tout voir » déplie la liste', async () => {
    const onOpen = jest.fn();
    const entries = [item('a'), item('b', { target: 'entretien', source: 'maintenance', type: 'vidange' })];
    await render(<FleetWatchSection items={entries} onOpen={onOpen} />);
    await fireEvent.press(screen.getAllByRole('button').find((b) => b.props.accessibilityLabel?.includes('maintenance.types.vidange')) as never);
    expect(onOpen).toHaveBeenCalledWith(entries[1]);
    await fireEvent.press(screen.getByText('flotte.watch.seeAll'));
    expect(screen.getByText('flotte.watch.collapse')).toBeTruthy();
    expect(screen.getAllByText('Dacia Logan')).toHaveLength(2); // toutes les cartes sont visibles à la fois
  });
});

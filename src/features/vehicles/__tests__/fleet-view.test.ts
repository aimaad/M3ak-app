/* eslint-disable import/first -- le « jest.mock » doit précéder l'import */
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));

import { parseFleetView } from '../use-fleet-view';

describe('vue Ma Flotte mémorisée', () => {
  it('ne reconnaît que « gallery » ; tout le reste donne la liste', () => {
    expect(parseFleetView('gallery')).toBe('gallery');
    expect(parseFleetView('list')).toBe('list');
    expect(parseFleetView(null)).toBe('list');
    expect(parseFleetView('n’importe quoi')).toBe('list');
  });
});

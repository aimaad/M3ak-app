/* eslint-disable import/first -- les « jest.mock » doivent précéder les imports */
const mockCheck = jest.fn();
jest.mock('../remote-exists', () => ({ checkVehicleExists: (...args: unknown[]) => mockCheck(...args) }));

import { act, renderHook } from '@testing-library/react-native';

import { useRemoteExists } from '../use-remote-exists';

describe('contrôle serveur du doublon pendant la saisie', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockCheck.mockReset();
  });
  afterEach(() => jest.useRealTimers());

  it('attend la fin de la frappe, puis rend la réponse', async () => {
    mockCheck.mockResolvedValue({ found: true, branchName: 'Rabat' });
    const { result } = await renderHook(() => useRemoteExists('a1', '8921 | ب | 14', ''));
    expect(result.current).toBeNull();
    expect(mockCheck).not.toHaveBeenCalled();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(500);
    });
    expect(mockCheck).toHaveBeenCalledWith('a1', { plate: '8921 | ب | 14', vin: '' });
    expect(result.current).toEqual({ found: true, branchName: 'Rabat' });
  });

  it('une réponse en retard ne s’affiche jamais pour une autre plaque', async () => {
    let resolveFirst: (value: unknown) => void = () => undefined;
    mockCheck.mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)));
    mockCheck.mockResolvedValueOnce({ found: false, branchName: null });
    const { result, rerender } = await renderHook(({ plate }: { plate: string }) => useRemoteExists('a1', plate, ''), { initialProps: { plate: '8921 | ب | 14' } });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(500);
    });
    await rerender({ plate: '1111 | د | 1' }); // la plaque change avant la première réponse
    expect(result.current).toBeNull();
    await act(async () => {
      resolveFirst({ found: true, branchName: 'Rabat' });
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(result.current).toBeNull(); // la réponse de l'ancienne plaque est ignorée
    await act(async () => {
      await jest.advanceTimersByTimeAsync(500);
    });
    expect(result.current).toEqual({ found: false, branchName: null });
  });

  it('pas d’appel sans agence ni plaque ni VIN', async () => {
    await renderHook(() => useRemoteExists(undefined, '8921 | ب | 14', ''));
    await renderHook(() => useRemoteExists('a1', '', ' '));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000);
    });
    expect(mockCheck).not.toHaveBeenCalled();
  });
});

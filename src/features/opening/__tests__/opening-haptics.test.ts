import { ENGINE_HAPTICS } from '../opening-haptics';

// Le stockage local n'existe pas sous Jest : on le remplace (la vibration n'en a besoin que pour sa préférence).
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

describe('vibration du moteur', () => {
  it('suit la durée du son (1,04 s) avec des impulsions de plus en plus rapprochées jusqu’au pic', () => {
    const offsets = ENGINE_HAPTICS.map(([offset]) => offset);
    expect([...offsets].sort((a, b) => a - b)).toEqual(offsets);
    expect(Math.max(...offsets)).toBeLessThanOrEqual(1040);
    // Autour du pic du son (≈ 280 ms) : au moins 6 impulsions à intervalles courts.
    const nearPeak = offsets.filter((o) => o >= 140 && o <= 330);
    expect(nearPeak.length).toBeGreaterThanOrEqual(6);
  });

  it('reste toujours doux : aucune impulsion plus forte que « léger »', () => {
    for (const [, intensity] of ENGINE_HAPTICS) expect(['soft', 'light']).toContain(intensity);
  });

  it('le plus fort (léger) est réservé à la montée et au pic du son', () => {
    const light = ENGINE_HAPTICS.filter(([, intensity]) => intensity === 'light').map(
      ([offset]) => offset
    );
    expect(Math.min(...light)).toBeGreaterThanOrEqual(120);
    expect(Math.max(...light)).toBeLessThanOrEqual(340);
  });
});

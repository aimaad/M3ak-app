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
    const nearPeak = offsets.filter((o) => o >= 130 && o <= 330);
    expect(nearPeak.length).toBeGreaterThanOrEqual(6);
  });

  it('reste modérée : jamais plus fort que « moyen »', () => {
    for (const [, intensity] of ENGINE_HAPTICS)
      expect(['soft', 'light', 'medium']).toContain(intensity);
  });

  it('démarre par un coup franc à l’instant du son, et le plus fort est réservé à la montée et au pic', () => {
    expect(ENGINE_HAPTICS[0]).toEqual([0, 'medium']);
    const medium = ENGINE_HAPTICS.filter(([, intensity]) => intensity === 'medium').map(
      ([offset]) => offset
    );
    expect(Math.max(...medium)).toBeLessThanOrEqual(340);
    // La fin (ralenti) reste discrète.
    expect(
      ENGINE_HAPTICS.filter(([offset]) => offset >= 500).every(
        ([, intensity]) => intensity === 'soft'
      )
    ).toBe(true);
  });
});

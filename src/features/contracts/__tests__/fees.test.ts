import {
  computeFraisCarburant,
  computeFraisRetard,
  computeRetardMinutes,
  RETARD_TOLERANCE_MINUTES,
} from '../fees';

describe('computeRetardMinutes', () => {
  it('renvoie 0 si le retour a lieu avant ou à l’heure prévue', () => {
    expect(computeRetardMinutes('2026-01-01T18:00:00Z', '2026-01-01T17:00:00Z')).toBe(0);
    expect(computeRetardMinutes('2026-01-01T18:00:00Z', '2026-01-01T18:00:00Z')).toBe(0);
  });

  it('calcule le retard réel en minutes', () => {
    expect(computeRetardMinutes('2026-01-01T18:00:00Z', '2026-01-01T19:30:00Z')).toBe(90);
  });
});

describe('computeFraisRetard', () => {
  it("n'applique aucun frais dans la tolérance", () => {
    expect(computeFraisRetard(0)).toBe(0);
    expect(computeFraisRetard(RETARD_TOLERANCE_MINUTES)).toBe(0);
  });

  it('facture par heure commencée au-delà de la tolérance', () => {
    expect(computeFraisRetard(16)).toBe(50); // 1h commencée
    expect(computeFraisRetard(60)).toBe(50); // exactement 1h
    expect(computeFraisRetard(61)).toBe(100); // 2h commencées
    expect(computeFraisRetard(125)).toBe(150); // 3h commencées
  });
});

describe('computeFraisCarburant', () => {
  it("n'applique aucun frais si le niveau est égal ou supérieur au départ", () => {
    expect(computeFraisCarburant(80, 80)).toBe(0);
    expect(computeFraisCarburant(50, 90)).toBe(0);
  });

  it('facture par tranche de 10% manquante', () => {
    expect(computeFraisCarburant(100, 95)).toBe(50); // 5% manquant -> 1 tranche
    expect(computeFraisCarburant(100, 80)).toBe(100); // 20% manquant -> 2 tranches
    expect(computeFraisCarburant(100, 71)).toBe(150); // 29% manquant -> 3 tranches
  });
});

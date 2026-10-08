import { computeUtilizationRate, sumPaymentsInMonth } from '../metrics';

describe('computeUtilizationRate', () => {
  it('renvoie 0 pour une flotte vide', () => {
    expect(computeUtilizationRate([])).toBe(0);
  });

  it('calcule le pourcentage de véhicules en location', () => {
    const vehicles = [
      { statut: 'en_location' as const },
      { statut: 'en_location' as const },
      { statut: 'disponible' as const },
      { statut: 'maintenance' as const },
    ];
    expect(computeUtilizationRate(vehicles)).toBe(50);
  });

  it('arrondit au pourcentage le plus proche', () => {
    const vehicles = [
      { statut: 'en_location' as const },
      { statut: 'disponible' as const },
      { statut: 'disponible' as const },
    ];
    expect(computeUtilizationRate(vehicles)).toBe(33);
  });
});

describe('sumPaymentsInMonth', () => {
  const reference = new Date('2026-03-15T00:00:00.000Z');

  it('additionne uniquement les paiements du mois de référence', () => {
    const payments = [
      { montant: 1000, datePaiement: '2026-03-01T10:00:00.000Z' },
      { montant: 500, datePaiement: '2026-03-20T10:00:00.000Z' },
      { montant: 9999, datePaiement: '2026-02-28T10:00:00.000Z' },
      { montant: 9999, datePaiement: '2026-04-01T10:00:00.000Z' },
    ];
    expect(sumPaymentsInMonth(payments, reference)).toBe(1500);
  });

  it("renvoie 0 s'il n'y a aucun paiement ce mois-ci", () => {
    expect(sumPaymentsInMonth([], reference)).toBe(0);
  });
});

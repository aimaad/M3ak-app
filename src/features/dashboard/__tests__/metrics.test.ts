import { computeUtilizationRate, revenueByDay, sumPaymentsInMonth } from '../metrics';

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

describe('revenueByDay', () => {
  const reference = new Date('2026-03-10T12:00:00.000Z');

  it('renvoie un point par jour, dans l\'ordre chronologique, aujourd\'hui inclus', () => {
    const points = revenueByDay([], 3, reference);
    expect(points.map((p) => p.date)).toEqual(['2026-03-08', '2026-03-09', '2026-03-10']);
    expect(points.every((p) => p.total === 0)).toBe(true);
  });

  it('additionne plusieurs paiements du même jour', () => {
    const payments = [
      { montant: 100, datePaiement: '2026-03-09T08:00:00.000Z' },
      { montant: 50, datePaiement: '2026-03-09T18:00:00.000Z' },
      { montant: 200, datePaiement: '2026-03-10T08:00:00.000Z' },
    ];
    const points = revenueByDay(payments, 3, reference);
    expect(points).toEqual([
      { date: '2026-03-08', total: 0 },
      { date: '2026-03-09', total: 150 },
      { date: '2026-03-10', total: 200 },
    ]);
  });

  it('ignore les paiements hors de la plage demandée', () => {
    const payments = [{ montant: 999, datePaiement: '2026-02-01T08:00:00.000Z' }];
    const points = revenueByDay(payments, 3, reference);
    expect(points.every((p) => p.total === 0)).toBe(true);
  });
});

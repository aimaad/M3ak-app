import { computeDurationDays, computeRentalPrice, computeSousTotal } from '../pricing';
import type { VehicleRates } from '../pricing';

describe('computeDurationDays', () => {
  it('compte 1 jour pour une location de quelques heures', () => {
    expect(computeDurationDays('2026-01-01T09:00:00.000Z', '2026-01-01T18:00:00.000Z')).toBe(1);
  });

  it('arrondit au jour supérieur dès qu’une journée est commencée', () => {
    // 24h01 -> 2 jours, pas 1
    expect(computeDurationDays('2026-01-01T09:00:00.000Z', '2026-01-02T09:01:00.000Z')).toBe(2);
  });

  it('compte exactement N jours pour une durée de N*24h', () => {
    expect(computeDurationDays('2026-01-01T09:00:00.000Z', '2026-01-04T09:00:00.000Z')).toBe(3);
  });

  it('renvoie 0 si la date de retour n’est pas après le départ', () => {
    expect(computeDurationDays('2026-01-02T09:00:00.000Z', '2026-01-01T09:00:00.000Z')).toBe(0);
    expect(computeDurationDays('2026-01-01T09:00:00.000Z', '2026-01-01T09:00:00.000Z')).toBe(0);
  });
});

describe('computeSousTotal', () => {
  const rates: VehicleRates = { prixJour: 300, prixSemaine: 1800, prixMois: 6000 };

  it('utilise le tarif journalier pour une courte durée', () => {
    expect(computeSousTotal(3, rates)).toEqual({ prixJourApplique: 300, sousTotal: 900 });
  });

  it('utilise le tarif hebdomadaire à partir de 7 jours', () => {
    // 10 jours = 1 semaine (1800) + 3 jours (900) = 2700
    expect(computeSousTotal(10, rates)).toEqual({ prixJourApplique: 270, sousTotal: 2700 });
  });

  it('utilise le tarif mensuel à partir de 28 jours', () => {
    // 30 jours = 1 mois (6000) + 2 jours (600) = 6600
    expect(computeSousTotal(30, rates)).toEqual({ prixJourApplique: 220, sousTotal: 6600 });
  });

  it('retombe sur le tarif journalier si le palier supérieur n’existe pas', () => {
    const dailyOnly: VehicleRates = { prixJour: 300, prixSemaine: null, prixMois: null };
    expect(computeSousTotal(10, dailyOnly)).toEqual({ prixJourApplique: 300, sousTotal: 3000 });
  });
});

describe('computeRentalPrice', () => {
  const rates: VehicleRates = { prixJour: 300, prixSemaine: 1800, prixMois: null };

  it('calcule le total avec frais et remise', () => {
    const result = computeRentalPrice(
      '2026-01-01T09:00:00.000Z',
      '2026-01-04T09:00:00.000Z',
      rates,
      150,
      50
    );
    expect(result).toEqual({
      dureeJours: 3,
      prixJourApplique: 300,
      sousTotal: 900,
      fraisSupplementaires: 150,
      remiseMontant: 50,
      total: 1000,
    });
  });

  it('ne descend jamais sous 0 même si la remise dépasse le sous-total', () => {
    const result = computeRentalPrice('2026-01-01T09:00:00.000Z', '2026-01-02T09:00:00.000Z', rates, 0, 10000);
    expect(result.total).toBe(0);
  });
});

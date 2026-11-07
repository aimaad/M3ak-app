import { buildPriorities, visiblePriorities } from '../priorities';

const base = {
  showMoney: true,
  lateReturns: 0,
  unpaid: { count: 0, total: 0 },
  expiredDocuments: 0,
  overdueMaintenance: 0,
  stoppedVehicles: 0,
};

describe('priorités de l’accueil', () => {
  it('rien d’anormal : aucune priorité', () => {
    expect(buildPriorities(base)).toEqual([]);
  });

  it('ordre : retards > impayés > documents > entretiens > véhicules à l’arrêt', () => {
    const list = buildPriorities({
      showMoney: true,
      lateReturns: 2,
      unpaid: { count: 8, total: 30500 },
      expiredDocuments: 1,
      overdueMaintenance: 3,
      stoppedVehicles: 2,
    });
    expect(list.map((p) => p.kind)).toEqual(['late', 'unpaid', 'documents', 'maintenance', 'stopped']);
    expect(list[1]).toEqual({ kind: 'unpaid', count: 8, amount: 30500 });
  });

  it('la carte trésorerie est réservée au propriétaire', () => {
    const list = buildPriorities({ ...base, showMoney: false, unpaid: { count: 4, total: 900 }, lateReturns: 1 });
    expect(list.map((p) => p.kind)).toEqual(['late']);
  });

  it('3 cartes au maximum, le compteur garde le total', () => {
    const list = buildPriorities({ ...base, lateReturns: 1, unpaid: { count: 1, total: 10 }, expiredDocuments: 1, overdueMaintenance: 1, stoppedVehicles: 1 });
    const { cards, total } = visiblePriorities(list);
    expect(cards).toHaveLength(3);
    expect(cards.map((p) => p.kind)).toEqual(['late', 'unpaid', 'documents']);
    expect(total).toBe(5);
  });
});

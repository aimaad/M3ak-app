import { fleetShares, sharePercent } from '../fleet-shares';

const counts = (overrides: Partial<Record<string, number>> = {}) =>
  ({ disponible: 0, en_location: 0, maintenance: 0, a_inspecter: 0, en_preparation: 0, indisponible: 0, tous: 0, ...overrides }) as never;

describe('fleetShares', () => {
  it('liste toujours les quatre statuts principaux, dans cet ordre', () => {
    expect(fleetShares(counts()).map((share) => share.key)).toEqual(['disponible', 'en_location', 'maintenance', 'a_inspecter']);
  });

  it('regroupe préparation et indisponible dans « autres », seulement s’il y en a', () => {
    expect(fleetShares(counts({ en_preparation: 1 })).at(-1)).toMatchObject({ key: 'others', value: 1 });
    expect(fleetShares(counts({ en_preparation: 2, indisponible: 3 })).at(-1)).toMatchObject({ key: 'others', value: 5 });
    expect(fleetShares(counts({ disponible: 4 })).some((share) => share.key === 'others')).toBe(false);
  });

  it('reprend les vrais nombres', () => {
    const shares = fleetShares(counts({ disponible: 3, en_location: 2, maintenance: 1, a_inspecter: 1 }));
    expect(shares.map((share) => share.value)).toEqual([3, 2, 1, 1]);
  });
});

describe('sharePercent', () => {
  it('arrondit et ne divise jamais par zéro', () => {
    expect(sharePercent(1, 3)).toBe(33);
    expect(sharePercent(2, 3)).toBe(67);
    expect(sharePercent(0, 0)).toBe(0);
    expect(sharePercent(5, 5)).toBe(100);
  });
});

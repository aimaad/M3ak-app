import { paginate } from '../pagination';

const list = Array.from({ length: 35 }, (_, i) => i + 1);

describe('paginate', () => {
  it('découpe en pages de la taille demandée', () => {
    const p = paginate(list, 1, 15);
    expect(p.items).toHaveLength(15);
    expect(p.pageCount).toBe(3);
    expect(paginate(list, 3, 15).items).toEqual([31, 32, 33, 34, 35]);
  });
  it('ramène une page hors limites dans les limites', () => {
    expect(paginate(list, 9, 15).page).toBe(3);
    expect(paginate(list, 0, 15).page).toBe(1);
  });
  it('gère une liste vide', () => {
    expect(paginate([], 1)).toEqual({ items: [], page: 1, pageCount: 1, total: 0 });
  });
});

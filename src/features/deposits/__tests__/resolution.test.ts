import { resolveDeposit } from '../resolution';

describe('resolveDeposit', () => {
  it('restitue tout si aucune retenue', () => {
    expect(resolveDeposit(2000, 0)).toEqual({
      montantRetenu: 0,
      montantRestitue: 2000,
      statut: 'restituee',
    });
  });

  it('retient tout si la retenue demandée égale ou dépasse la caution', () => {
    expect(resolveDeposit(2000, 2000)).toEqual({
      montantRetenu: 2000,
      montantRestitue: 0,
      statut: 'retenue',
    });
    expect(resolveDeposit(2000, 5000)).toEqual({
      montantRetenu: 2000,
      montantRestitue: 0,
      statut: 'retenue',
    });
  });

  it('retient partiellement et restitue le reste', () => {
    expect(resolveDeposit(2000, 500)).toEqual({
      montantRetenu: 500,
      montantRestitue: 1500,
      statut: 'partiellement_retenue',
    });
  });

  it('ne descend jamais sous 0 même avec une retenue négative demandée', () => {
    expect(resolveDeposit(2000, -100)).toEqual({
      montantRetenu: 0,
      montantRestitue: 2000,
      statut: 'restituee',
    });
  });
});

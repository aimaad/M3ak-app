import { shareMessage } from '../share';

describe('texte partagé', () => {
  const vehicle = { marque: 'DACIA', modele: 'LOGAN', immatriculation: '8921-ب-14', prixJour: 500 };
  it('propriétaire : nom, plaque et prix par jour', () => {
    expect(shareMessage(vehicle, { showPrice: true, perDay: 'MAD/j' })).toBe('Dacia Logan\n8921 | ب | 14\n500 MAD/j');
  });
  it('autres rôles : aucun montant', () => {
    expect(shareMessage(vehicle, { showPrice: false, perDay: 'MAD/j' })).toBe('Dacia Logan\n8921 | ب | 14');
  });
  it('prix à 0 : pas de ligne de prix', () => {
    expect(shareMessage({ ...vehicle, prixJour: 0 }, { showPrice: true, perDay: 'MAD/j' })).toBe('Dacia Logan\n8921 | ب | 14');
  });
});

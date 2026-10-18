import { isAgencyFormDirty, type AgencyDetailsFormValues } from '../validation';

const saved: AgencyDetailsFormValues = { nom: 'Atlas', raisonSociale: '', email: 'a@b.ma', telephone: '', adresse: '', ville: 'Rabat', pays: 'Maroc', devise: 'MAD' };

describe('modifications non enregistrées (Mon entreprise)', () => {
  it('aucune modification : pas d\'alerte', () => {
    expect(isAgencyFormDirty({ ...saved }, saved)).toBe(false);
  });

  it('un champ modifié déclenche l\'alerte', () => {
    expect(isAgencyFormDirty({ ...saved, telephone: '+212600000000' }, saved)).toBe(true);
    expect(isAgencyFormDirty({ ...saved, adresse: '12 rue Hassan II' }, saved)).toBe(true);
    expect(isAgencyFormDirty({ ...saved, nom: 'Atlas Cars' }, saved)).toBe(true);
  });

  it('des espaces autour d\'un texte ne comptent pas comme une modification', () => {
    expect(isAgencyFormDirty({ ...saved, nom: '  Atlas ', ville: 'Rabat  ' }, saved)).toBe(false);
  });

  it('effacer un champ rempli est une modification', () => {
    expect(isAgencyFormDirty({ ...saved, ville: '' }, saved)).toBe(true);
  });
});

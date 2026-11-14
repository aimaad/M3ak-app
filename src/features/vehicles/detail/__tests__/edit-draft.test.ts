import type { Vehicle } from '../../types';
import { documentChanges, documentsDraft, EDITABLE_DOCUMENT_TYPES, hasSpecsChanges, specsDraft, specsPatch, validateSpecs } from '../edit-draft';

const vehicle = { id: 'v1', categorie: 'economique', transmission: null, carburant: 'diesel', kilometrage: 59_000, couleur: 'Blanc', annee: 2021, nombrePlaces: 5, puissanceFiscale: null, documents: [] } as unknown as Vehicle;

describe('fiche technique : brouillon et validation', () => {
  it('le brouillon reprend la fiche ; sans changement : rien à enregistrer', () => {
    const draft = specsDraft(vehicle);
    expect(draft).toMatchObject({ kilometrage: '59000', couleur: 'Blanc', annee: '2021', puissanceFiscale: '' });
    expect(hasSpecsChanges(vehicle, draft)).toBe(false);
    expect(specsPatch(vehicle, draft)).toEqual({});
  });

  it('seuls les champs modifiés partent dans le patch (nombres en nombres, vide → null)', () => {
    const patch = specsPatch(vehicle, { ...specsDraft(vehicle), transmission: 'manuelle', kilometrage: '60 000'.replace(' ', ''), puissanceFiscale: '6', couleur: '  ', annee: '' });
    expect(patch).toEqual({ transmission: 'manuelle', kilometrage: 60000, puissanceFiscale: 6, couleur: null, annee: null });
  });

  it('mêmes règles que le formulaire : année, places, puissance, kilométrage', () => {
    const errors = validateSpecs({ ...specsDraft(vehicle), annee: '1800', nombrePlaces: '12', puissanceFiscale: '99', kilometrage: '-5' });
    expect(errors).toEqual({ annee: 'invalid_year', nombrePlaces: 'invalid_seats', puissanceFiscale: 'invalid_cv', kilometrage: 'invalid_number' });
  });

  it('champs vides facultatifs : aucune erreur ; les autres champs du formulaire n’en provoquent pas', () => {
    expect(validateSpecs({ ...specsDraft(vehicle), annee: '', nombrePlaces: '', puissanceFiscale: '', couleur: '' })).toEqual({});
  });
});

describe('documents (carte grise) : brouillon et changements', () => {
  it('sans nouvelle photo : aucun changement', () => {
    expect(documentChanges(documentsDraft())).toEqual([]);
  });

  it('nouvelles photos : recto et verso à envoyer', () => {
    const draft = documentsDraft();
    draft.carte_grise = { localUri: 'file:///recto.jpg' };
    draft.carte_grise_verso = { localUri: 'file:///verso.jpg' };
    expect(documentChanges(draft)).toEqual([{ type: 'carte_grise', localUri: 'file:///recto.jpg' }, { type: 'carte_grise_verso', localUri: 'file:///verso.jpg' }]);
  });

  it('seuls la carte grise recto et verso sont modifiables ici (l’assurance et la visite sont dans les obligations)', () => {
    expect(EDITABLE_DOCUMENT_TYPES).toEqual(['carte_grise', 'carte_grise_verso']);
  });
});

import type { Vehicle, VehicleDocument } from '../../types';
import { documentChanges, documentsDraft, hasSpecsChanges, specsDraft, specsPatch, validateDocuments, validateSpecs } from '../edit-draft';

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

describe('documents : brouillon et changements', () => {
  const doc = (type: VehicleDocument['type'], expiresAt: string | null): VehicleDocument => ({ type, path: `p-${type}`, uploadedAt: '2026-01-01T00:00:00Z', expiresAt });

  it('date d’expiration affichée en JJ/MM/AAAA ; sans modification : aucun changement', () => {
    const existing = [doc('assurance', '2026-12-26')];
    const draft = documentsDraft({ ...vehicle, documents: existing } as Vehicle);
    expect(draft.assurance.expiry).toBe('26/12/2026');
    expect(documentChanges(existing, draft)).toEqual([]);
  });

  it('date corrigée sur un document déjà là : changement sans nouvelle photo', () => {
    const existing = [doc('assurance', '2026-12-26')];
    const draft = documentsDraft({ ...vehicle, documents: existing } as Vehicle);
    draft.assurance.expiry = '31/01/2027';
    expect(documentChanges(existing, draft)).toEqual([{ type: 'assurance', localUri: null, expiresAt: '2027-01-31' }]);
  });

  it('nouvelle photo : à envoyer, avec sa date', () => {
    const draft = documentsDraft(vehicle);
    draft.visite_technique = { localUri: 'file:///v.jpg', expiry: '23/11/2026' };
    expect(documentChanges([], draft)).toEqual([{ type: 'visite_technique', localUri: 'file:///v.jpg', expiresAt: '2026-11-23' }]);
  });

  it('une date sans document (ni photo) n’est pas enregistrée ; date invalide refusée', () => {
    const draft = documentsDraft(vehicle);
    draft.assurance.expiry = '12/12/2026';
    expect(documentChanges([], draft)).toEqual([]);
    draft.assurance.expiry = '32/13/2026';
    expect(validateDocuments(draft)).toEqual({ assurance: 'invalid_date' });
  });
});

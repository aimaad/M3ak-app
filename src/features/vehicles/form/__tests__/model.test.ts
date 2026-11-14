/* eslint-disable import/first -- le « jest.mock » doit précéder les imports */
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));

import { emptyVehicleFields, type VehicleOcrFields } from '../../ocr';
import type { Vehicle } from '../../types';
import { applyScan, buildInput, changedFields, draftFromVehicle, firstErrorField, missingAfterScan, validateDraft } from '../model';

const base = { id: 'v1', agencyId: 'a', branchId: null, marque: 'DACIA', modele: 'LOGAN', immatriculation: '8921-ب-14', vin: null, finition: null, annee: 2021, categorie: null, couleur: 'BLANC', nombrePlaces: 5, transmission: null, carburant: 'diesel', kilometrage: 0, niveauCarburant: null, statut: 'disponible', prixJour: 500, prixSemaine: null, prixMois: null, description: null, dateMiseEnCirculation: null, puissanceFiscale: null, photos: [], documents: [] } as unknown as Vehicle;
const opts = { showPrices: true, initialKm: '' };
const field = <T,>(value: T | null, confidence: 'high' | 'medium' | 'low' = 'high') => ({ value, confidence });
const read = (patch: Partial<Record<keyof VehicleOcrFields, { value: unknown; confidence: 'high' | 'medium' | 'low' }>>): VehicleOcrFields => ({ ...emptyVehicleFields(), ...(patch as object) }) as VehicleOcrFields;

describe('brouillon', () => {
  it('une valeur vide reste vide : 0 km, boîte inconnue, couleur absente ne deviennent ni « 0 » ni une valeur par défaut', () => {
    const draft = draftFromVehicle(base);
    expect(draft.kilometrage).toBe('');
    expect(draft.transmission).toBeNull();
    expect(draft.puissanceFiscale).toBe('');
    expect(draftFromVehicle({ ...base, couleur: null }).couleur).toBe('');
  });
  it('un kilométrage enregistré est repris tel quel', () => {
    expect(draftFromVehicle({ ...base, kilometrage: 48200 }).kilometrage).toBe('48200');
  });
});

describe('champs modifiés (barre d’enregistrement)', () => {
  it('rien de modifié : liste vide', () => {
    const draft = draftFromVehicle(base);
    expect(changedFields(draft, { ...draft })).toEqual([]);
  });
  it('dans l’ordre d’affichage : boîte, kilométrage, couleur', () => {
    const draft = draftFromVehicle(base);
    expect(changedFields(draft, { ...draft, couleur: 'Gris', kilometrage: '48200', transmission: 'manuelle' })).toEqual(['transmission', 'kilometrage', 'couleur']);
  });
  it('un espace en plus n’est pas une modification', () => {
    const draft = draftFromVehicle(base);
    expect(changedFields(draft, { ...draft, marque: 'DACIA ' })).toEqual([]);
  });
  it('« BLANC » affiché « Blanc » n’est PAS une modification tant que l’utilisateur ne touche à rien', () => {
    const draft = draftFromVehicle(base);
    expect(changedFields(draft, draft)).toEqual([]);
  });
});

describe('validation', () => {
  it('rien d’invalide : aucune erreur (kilométrage resté vide à 0 : accepté)', () => {
    expect(validateDraft(draftFromVehicle(base), opts)).toEqual({});
  });
  it('un kilométrage enregistré qu’on vide : erreur précise', () => {
    const draft = { ...draftFromVehicle({ ...base, kilometrage: 48200 }), kilometrage: '' };
    expect(validateDraft(draft, { showPrices: false, initialKm: '48200' }).kilometrage?.code).toBe('km_required');
  });
  it('puissance, places, année, niveau : messages précis', () => {
    const draft = { ...draftFromVehicle(base), puissanceFiscale: '99', nombrePlaces: 12, annee: '1800', niveauCarburant: '120' };
    const errors = validateDraft(draft, opts);
    expect(errors.puissanceFiscale?.code).toBe('power_invalid');
    expect(errors.nombrePlaces?.code).toBe('seats_invalid');
    expect(errors.annee?.code).toBe('year_invalid');
    expect(errors.niveauCarburant?.code).toBe('level_invalid');
  });
  it('date de mise en circulation dans le futur refusée', () => {
    expect(validateDraft({ ...draftFromVehicle(base), dateMiseEnCirculation: '2099-01-01' }, opts).dateMiseEnCirculation?.code).toBe('date_invalid');
  });
  it('marque, modèle et plaque obligatoires', () => {
    const errors = validateDraft({ ...draftFromVehicle(base), marque: ' ', modele: '', immatriculation: '' }, opts);
    expect(Object.keys(errors)).toEqual(expect.arrayContaining(['marque', 'modele', 'immatriculation']));
  });
  it('employé : les prix ne sont pas contrôlés (il ne les voit pas)', () => {
    const draft = { ...draftFromVehicle(base), prixJour: null };
    expect(validateDraft(draft, { showPrices: false, initialKm: '' }).prixJour).toBeUndefined();
    expect(validateDraft(draft, { showPrices: true, initialKm: '' }).prixJour?.code).toBe('price_required');
  });
  it('premier champ en erreur dans l’ordre d’affichage', () => {
    const errors = validateDraft({ ...draftFromVehicle(base), puissanceFiscale: '99', marque: '' }, opts);
    expect(firstErrorField(errors)).toBe('puissanceFiscale');
  });
});

describe('ce qui est enregistré', () => {
  it('kilométrage resté vide : la valeur enregistrée est conservée', () => {
    const input = buildInput(draftFromVehicle(base), base, { showPrices: true, canChooseBranch: false });
    expect(input.kilometrage).toBe(0);
  });
  it('employé : prix intouchés, quoi que contienne le brouillon', () => {
    const draft = { ...draftFromVehicle({ ...base, prixSemaine: 3000 }), prixJour: 1, prixSemaine: '1', prixMois: '1' };
    const input = buildInput(draft, { ...base, prixSemaine: 3000 }, { showPrices: false, canChooseBranch: false });
    expect(input).toMatchObject({ prixJour: 500, prixSemaine: 3000, prixMois: null });
  });
  it('propriétaire : les prix sont enregistrés ; vide → null', () => {
    const draft = { ...draftFromVehicle(base), prixJour: 550, prixSemaine: '3000', prixMois: '' };
    expect(buildInput(draft, base, { showPrices: true, canChooseBranch: false })).toMatchObject({ prixJour: 550, prixSemaine: 3000, prixMois: null });
  });
  it('couleur et boîte choisies sont enregistrées ; la filiale seulement si on peut la choisir', () => {
    const draft = { ...draftFromVehicle(base), couleur: 'Gris', transmission: 'automatique' as const, branchId: 'b2' };
    expect(buildInput(draft, base, { showPrices: true, canChooseBranch: false })).not.toHaveProperty('branchId');
    expect(buildInput(draft, base, { showPrices: true, canChooseBranch: true })).toMatchObject({ couleur: 'Gris', transmission: 'automatique', branchId: 'b2' });
  });
});

describe('scan de la carte grise', () => {
  it('remplit seulement les champs vides avec une lecture sûre', () => {
    const draft = { ...draftFromVehicle(base), marque: '', couleur: '', puissanceFiscale: '' };
    const result = applyScan(draft, read({ marque: field('Dacia'), puissanceFiscale: field(6), couleur: field('BLANC', 'medium'), modele: field('Sandero') }));
    expect(result.draft).toMatchObject({ marque: 'Dacia', puissanceFiscale: '6', couleur: 'Blanc', modele: 'LOGAN' });
    expect(result.filled).toEqual(expect.arrayContaining(['marque', 'puissanceFiscale', 'couleur']));
    expect(result.filled).not.toContain('modele'); // déjà renseigné : jamais écrasé
  });
  it('une lecture douteuse (confiance faible) n’est jamais reprise', () => {
    const result = applyScan({ ...draftFromVehicle(base), puissanceFiscale: '' }, read({ puissanceFiscale: field(6, 'low') }));
    expect(result.draft.puissanceFiscale).toBe('');
    expect(result.filled).toEqual([]);
  });
  it('rien lu : rien n’est modifié', () => {
    const draft = draftFromVehicle(base);
    const result = applyScan(draft, emptyVehicleFields());
    expect(result.draft).toEqual(draft);
    expect(result.filled).toEqual([]);
  });
  it('ce qui manque encore : la boîte (jamais sur la carte), puis les champs vides', () => {
    expect(missingAfterScan(draftFromVehicle(base))).toEqual(['transmission', 'kilometrage', 'puissanceFiscale', 'categorie']);
    expect(missingAfterScan({ ...draftFromVehicle(base), transmission: 'manuelle', kilometrage: '1', puissanceFiscale: '6', categorie: 'suv' })).toEqual([]);
  });
});

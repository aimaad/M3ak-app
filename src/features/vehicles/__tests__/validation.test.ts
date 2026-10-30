import {
  fromIsoDate,
  isDuplicatePlateError,
  isFormValid,
  toVehicleInput,
  validateVehicleForm,
  type VehicleFormValues,
} from '../validation';

function makeValues(overrides: Partial<VehicleFormValues> = {}): VehicleFormValues {
  return {
    marque: 'Dacia',
    modele: 'Logan',
    immatriculation: '8921-أ-14',
    vin: '',
    finition: '',
    annee: '2022',
    categorie: 'economique',
    couleur: 'Blanc',
    nombrePlaces: '5',
    transmission: 'manuelle',
    carburant: 'diesel',
    kilometrage: '32000',
    niveauCarburant: '80',
    prixJour: '250',
    prixSemaine: '1500',
    prixMois: '5000',
    description: '',
    statut: 'disponible',
    ...overrides,
  };
}

describe('validateVehicleForm', () => {
  it("n'a aucune erreur pour des valeurs valides", () => {
    const errors = validateVehicleForm(makeValues());
    expect(isFormValid(errors)).toBe(true);
  });

  it("n'a aucune erreur si les champs optionnels sont vides", () => {
    const errors = validateVehicleForm(
      makeValues({ couleur: '', nombrePlaces: '', niveauCarburant: '', prixSemaine: '', prixMois: '', description: '' })
    );
    expect(isFormValid(errors)).toBe(true);
  });

  it('exige marque, modèle et immatriculation', () => {
    const errors = validateVehicleForm(makeValues({ marque: '', modele: '  ', immatriculation: '' }));
    expect(errors.marque).toBe('required');
    expect(errors.modele).toBe('required');
    expect(errors.immatriculation).toBe('required');
  });

  it("accepte une année vide (facultative) mais rejette une année absurde", () => {
    expect(validateVehicleForm(makeValues({ annee: '' })).annee).toBeUndefined();
    expect(validateVehicleForm(makeValues({ annee: '1899' })).annee).toBe('invalid_year');
    expect(validateVehicleForm(makeValues({ annee: '3000' })).annee).toBe('invalid_year');
  });

  it('rejette un kilométrage négatif ou vide', () => {
    expect(validateVehicleForm(makeValues({ kilometrage: '-5' })).kilometrage).toBe('invalid_number');
    expect(validateVehicleForm(makeValues({ kilometrage: '' })).kilometrage).toBe('invalid_number');
  });

  it('rejette un prix/jour à 0 ou négatif', () => {
    expect(validateVehicleForm(makeValues({ prixJour: '0' })).prixJour).toBe('invalid_price');
    expect(validateVehicleForm(makeValues({ prixJour: '-10' })).prixJour).toBe('invalid_price');
  });

  it('rejette un prix semaine/mois négatif ou nul', () => {
    expect(validateVehicleForm(makeValues({ prixSemaine: '0' })).prixSemaine).toBe('invalid_price');
    expect(validateVehicleForm(makeValues({ prixMois: '-10' })).prixMois).toBe('invalid_price');
  });

  it('rejette un nombre de places hors de 1 à 9', () => {
    expect(validateVehicleForm(makeValues({ nombrePlaces: '0' })).nombrePlaces).toBe('invalid_seats');
    expect(validateVehicleForm(makeValues({ nombrePlaces: '15' })).nombrePlaces).toBe('invalid_seats');
    expect(validateVehicleForm(makeValues({ nombrePlaces: '2.5' })).nombrePlaces).toBe('invalid_seats');
  });

  it('rejette un niveau de carburant hors de 0 à 100', () => {
    expect(validateVehicleForm(makeValues({ niveauCarburant: '-1' })).niveauCarburant).toBe('invalid_fuel_level');
    expect(validateVehicleForm(makeValues({ niveauCarburant: '101' })).niveauCarburant).toBe('invalid_fuel_level');
  });
});

describe('toVehicleInput', () => {
  it('convertit les chaînes du formulaire en nombres, et rogne les espaces', () => {
    const input = toVehicleInput(makeValues({ marque: '  Dacia  ', annee: '2022', kilometrage: '32000', prixJour: '250.5' }));
    expect(input.marque).toBe('Dacia');
    expect(input.annee).toBe(2022);
    expect(input.kilometrage).toBe(32000);
    expect(input.prixJour).toBe(250.5);
  });

  it('convertit une année vide en null', () => {
    expect(toVehicleInput(makeValues({ annee: '' })).annee).toBeNull();
  });

  it('convertit les champs optionnels vides en null', () => {
    const input = toVehicleInput(
      makeValues({ couleur: '', nombrePlaces: '', niveauCarburant: '', prixSemaine: '', prixMois: '', description: '' })
    );
    expect(input.couleur).toBeNull();
    expect(input.nombrePlaces).toBeNull();
    expect(input.niveauCarburant).toBeNull();
    expect(input.prixSemaine).toBeNull();
    expect(input.prixMois).toBeNull();
    expect(input.description).toBeNull();
  });
});

describe('isDuplicatePlateError', () => {
  it('reconnaît une violation de contrainte unique Postgres (23505)', () => {
    expect(isDuplicatePlateError({ code: '23505', message: 'duplicate key value' })).toBe(true);
  });

  it('ignore les autres erreurs', () => {
    expect(isDuplicatePlateError({ code: '42501', message: 'rls' })).toBe(false);
    expect(isDuplicatePlateError(new Error('boom'))).toBe(false);
    expect(isDuplicatePlateError(null)).toBe(false);
  });
});

describe('informations de la carte grise : date de mise en circulation et puissance fiscale', () => {
  const base = makeValues({});

  it('accepte une date JJ/MM/AAAA et une puissance valides, et les convertit', () => {
    const values = { ...base, dateMiseEnCirculation: '27/08/2025', puissanceFiscale: '6' };
    expect(validateVehicleForm(values).dateMiseEnCirculation).toBeUndefined();
    expect(validateVehicleForm(values).puissanceFiscale).toBeUndefined();
    const input = toVehicleInput(values);
    expect(input.dateMiseEnCirculation).toBe('2025-08-27');
    expect(input.puissanceFiscale).toBe(6);
    expect(fromIsoDate('2025-08-27')).toBe('27/08/2025');
  });

  it('refuse une date inexistante ou future et une puissance hors limites', () => {
    expect(validateVehicleForm({ ...base, dateMiseEnCirculation: '31/02/2025' }).dateMiseEnCirculation).toBe('invalid_date');
    expect(validateVehicleForm({ ...base, dateMiseEnCirculation: '01/01/2999' }).dateMiseEnCirculation).toBe('invalid_date');
    expect(validateVehicleForm({ ...base, puissanceFiscale: '0' }).puissanceFiscale).toBe('invalid_cv');
    expect(validateVehicleForm({ ...base, puissanceFiscale: '99' }).puissanceFiscale).toBe('invalid_cv');
  });

  it('les deux champs restent facultatifs', () => {
    const errors = validateVehicleForm({ ...base, dateMiseEnCirculation: '', puissanceFiscale: '' });
    expect(errors.dateMiseEnCirculation).toBeUndefined();
    expect(toVehicleInput({ ...base, dateMiseEnCirculation: '', puissanceFiscale: '' }).dateMiseEnCirculation).toBeNull();
  });
});

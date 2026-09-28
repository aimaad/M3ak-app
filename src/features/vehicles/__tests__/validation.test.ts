import { isFormValid, toVehicleInput, validateVehicleForm, type VehicleFormValues } from '../validation';

function makeValues(overrides: Partial<VehicleFormValues> = {}): VehicleFormValues {
  return {
    marque: 'Dacia',
    modele: 'Logan',
    immatriculation: '8921-أ-14',
    annee: '2022',
    carburant: 'diesel',
    kilometrage: '32000',
    prixJour: '250',
    statut: 'disponible',
    ...overrides,
  };
}

describe('validateVehicleForm', () => {
  it("n'a aucune erreur pour des valeurs valides", () => {
    const errors = validateVehicleForm(makeValues());
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
});

import {
  isMaintenanceFormValid,
  isValidMaintenanceCost,
  validateMaintenanceForm,
  type MaintenanceFormValues,
} from '../validation';

function makeValues(overrides: Partial<MaintenanceFormValues> = {}): MaintenanceFormValues {
  return {
    vehicleId: 'vehicle-1',
    type: 'vidange',
    echeanceDate: '2026-04-01',
    echeanceKm: '',
    notes: '',
    ...overrides,
  };
}

describe('validateMaintenanceForm', () => {
  it("n'a aucune erreur avec une date d'échéance valide", () => {
    expect(isMaintenanceFormValid(validateMaintenanceForm(makeValues()))).toBe(true);
  });

  it("n'a aucune erreur avec un kilométrage d'échéance seul", () => {
    const errors = validateMaintenanceForm(makeValues({ echeanceDate: '', echeanceKm: '50000' }));
    expect(isMaintenanceFormValid(errors)).toBe(true);
  });

  it('exige un véhicule', () => {
    expect(validateMaintenanceForm(makeValues({ vehicleId: '' })).vehicleId).toBe('required');
  });

  it('exige au moins une échéance (date ou kilométrage)', () => {
    const errors = validateMaintenanceForm(makeValues({ echeanceDate: '', echeanceKm: '' }));
    expect(errors.echeanceDate).toBe('need_one');
  });

  it('rejette un format de date invalide', () => {
    expect(validateMaintenanceForm(makeValues({ echeanceDate: '01/04/2026' })).echeanceDate).toBe(
      'invalid_date'
    );
  });

  it('rejette un kilométrage négatif ou non numérique', () => {
    expect(
      validateMaintenanceForm(makeValues({ echeanceDate: '', echeanceKm: '-5' })).echeanceKm
    ).toBe('invalid_number');
    expect(
      validateMaintenanceForm(makeValues({ echeanceDate: '', echeanceKm: 'abc' })).echeanceKm
    ).toBe('invalid_number');
  });

  it("n'exige pas d'échéance pour une panne (incident signalé maintenant)", () => {
    const errors = validateMaintenanceForm(makeValues({ type: 'panne', echeanceDate: '', echeanceKm: '' }));
    expect(isMaintenanceFormValid(errors)).toBe(true);
  });
});

describe('isValidMaintenanceCost', () => {
  it('accepte une valeur vide (coût facultatif)', () => {
    expect(isValidMaintenanceCost('')).toBe(true);
  });

  it('accepte un coût positif', () => {
    expect(isValidMaintenanceCost('450')).toBe(true);
    expect(isValidMaintenanceCost('450.50')).toBe(true);
  });

  it('rejette un coût négatif ou non numérique', () => {
    expect(isValidMaintenanceCost('-10')).toBe(false);
    expect(isValidMaintenanceCost('abc')).toBe(false);
  });
});

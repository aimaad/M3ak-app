import { isRentalFormValid, validateRentalForm, type RentalFormValues } from '../validation';

function makeValues(overrides: Partial<RentalFormValues> = {}): RentalFormValues {
  return {
    vehicleId: 'vehicle-1',
    customerId: 'customer-1',
    driverId: null,
    dateDebutPrevue: '2026-03-10T09:00:00.000Z',
    dateFinPrevue: '2026-03-15T09:00:00.000Z',
    lieuDepart: '',
    lieuRetour: '',
    fraisSupplementaires: '0',
    remiseMontant: '0',
    acomptePrevu: '0',
    cautionMontant: '2000',
    notes: '',
    ...overrides,
  };
}

describe('validateRentalForm', () => {
  it("n'a aucune erreur pour des valeurs valides", () => {
    expect(isRentalFormValid(validateRentalForm(makeValues(), false))).toBe(true);
  });

  it('exige le véhicule et le client', () => {
    const errors = validateRentalForm(makeValues({ vehicleId: '', customerId: '' }), false);
    expect(errors.vehicleId).toBe('required');
    expect(errors.customerId).toBe('required');
  });

  it('exige les deux dates', () => {
    expect(validateRentalForm(makeValues({ dateDebutPrevue: '' }), false).dates).toBe('required');
  });

  it('rejette une date de fin antérieure ou égale à la date de début', () => {
    expect(
      validateRentalForm(
        makeValues({ dateDebutPrevue: '2026-03-15T09:00:00.000Z', dateFinPrevue: '2026-03-10T09:00:00.000Z' }),
        false
      ).dates
    ).toBe('invalid_date_range');
    expect(
      validateRentalForm(makeValues({ dateDebutPrevue: '2026-03-10T09:00:00.000Z', dateFinPrevue: '2026-03-10T09:00:00.000Z' }), false)
        .dates
    ).toBe('invalid_date_range');
  });

  it('signale un conflit de réservation', () => {
    expect(validateRentalForm(makeValues(), true).dates).toBe('conflict');
  });

  it('la caution est obligatoire et positive', () => {
    expect(validateRentalForm(makeValues({ cautionMontant: '' }), false).cautionMontant).toBe('invalid_number');
    expect(validateRentalForm(makeValues({ cautionMontant: '-100' }), false).cautionMontant).toBe('invalid_number');
  });

  it('les frais, la remise et l’acompte sont facultatifs (0 par défaut) mais doivent être positifs', () => {
    expect(isRentalFormValid(validateRentalForm(makeValues({ fraisSupplementaires: '', remiseMontant: '', acomptePrevu: '' }), false))).toBe(true);
    expect(validateRentalForm(makeValues({ fraisSupplementaires: '-1' }), false).fraisSupplementaires).toBe('invalid_number');
    expect(validateRentalForm(makeValues({ remiseMontant: '-1' }), false).remiseMontant).toBe('invalid_number');
    expect(validateRentalForm(makeValues({ acomptePrevu: '-1' }), false).acomptePrevu).toBe('invalid_number');
  });
});

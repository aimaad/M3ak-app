import { isRentalFormValid, validateRentalForm, type RentalFormValues } from '../validation';

function makeValues(overrides: Partial<RentalFormValues> = {}): RentalFormValues {
  return {
    vehicleId: 'vehicle-1',
    customerId: 'customer-1',
    dateDebutPrevue: '2026-03-10',
    dateFinPrevue: '2026-03-15',
    prixTotal: '1500',
    cautionMontant: '2000',
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

  it('rejette une date de fin antérieure à la date de début', () => {
    const errors = validateRentalForm(
      makeValues({ dateDebutPrevue: '2026-03-15', dateFinPrevue: '2026-03-10' }),
      false
    );
    expect(errors.dates).toBe('invalid_date_range');
  });

  it('signale un conflit de réservation', () => {
    expect(validateRentalForm(makeValues(), true).dates).toBe('conflict');
  });

  it('la caution est obligatoire et positive', () => {
    expect(validateRentalForm(makeValues({ cautionMontant: '' }), false).cautionMontant).toBe(
      'invalid_number'
    );
    expect(validateRentalForm(makeValues({ cautionMontant: '-100' }), false).cautionMontant).toBe(
      'invalid_number'
    );
  });

  it('le prix total est facultatif mais doit être positif si renseigné', () => {
    expect(validateRentalForm(makeValues({ prixTotal: '' }), false).prixTotal).toBeUndefined();
    expect(validateRentalForm(makeValues({ prixTotal: '-1' }), false).prixTotal).toBe('invalid_number');
  });
});

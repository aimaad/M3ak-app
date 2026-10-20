import { canReachStep, firstInvalidStep, isStepValid, stepErrorKeys } from '../wizard';

describe('création de location par étapes', () => {
  it("chaque étape ne bloque que sur ses propres champs", () => {
    const errors = { customerId: 'required', dates: 'required' } as const;
    expect(isStepValid('client', errors)).toBe(false);
    expect(isStepValid('vehicule', errors)).toBe(true);
    expect(isStepValid('dates', errors)).toBe(false);
    expect(isStepValid('conducteurs', errors)).toBe(true);
    expect(isStepValid('prix', errors)).toBe(true);
    expect(stepErrorKeys('recap', errors)).toEqual(['customerId', 'dates']);
  });

  it('le prix regroupe frais, remise, acompte et caution', () => {
    expect(isStepValid('prix', { cautionMontant: 'invalid_number' })).toBe(false);
    expect(isStepValid('prix', { acomptePrevu: 'invalid_number' })).toBe(false);
    expect(isStepValid('prix', {})).toBe(true);
  });

  it('trouve la première étape à corriger', () => {
    expect(firstInvalidStep({})).toBeNull();
    expect(firstInvalidStep({ cautionMontant: 'invalid_number', vehicleId: 'required' })).toBe('vehicule');
    expect(firstInvalidStep({ dates: 'conflict' })).toBe('dates');
  });

  it("n'ouvre une étape que si les précédentes sont valides", () => {
    expect(canReachStep('client', { customerId: 'required' })).toBe(true);
    expect(canReachStep('vehicule', { customerId: 'required' })).toBe(false);
    expect(canReachStep('recap', {})).toBe(true);
    expect(canReachStep('prix', { dates: 'invalid_date_range' })).toBe(false);
  });
});

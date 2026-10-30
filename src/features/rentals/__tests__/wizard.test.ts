import { canReachStep, firstInvalidStep, isStepValid, stepErrorKeys, WIZARD_STEPS } from '../wizard';

describe('création de location par étapes', () => {
  it("commence par les dates, puis les voitures libres, avant le client", () => {
    expect(WIZARD_STEPS.slice(0, 3)).toEqual(['dates', 'vehicule', 'client']);
  });

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
    expect(firstInvalidStep({ cautionMontant: 'invalid_number', vehicleId: 'required', customerId: 'required' })).toBe('vehicule');
    expect(firstInvalidStep({ dates: 'conflict' })).toBe('dates');
  });

  it("n'ouvre une étape que si les précédentes sont valides", () => {
    expect(canReachStep('dates', { dates: 'required' })).toBe(true);
    expect(canReachStep('vehicule', { dates: 'required' })).toBe(false);
    expect(canReachStep('client', { vehicleId: 'required' })).toBe(false);
    expect(canReachStep('recap', {})).toBe(true);
    expect(canReachStep('prix', { dates: 'invalid_date_range' })).toBe(false);
  });
});

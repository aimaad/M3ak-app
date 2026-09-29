import { validateOdometerForm } from '../validation';

describe('validateOdometerForm', () => {
  it("n'a aucune erreur pour des valeurs valides", () => {
    expect(validateOdometerForm({ kilometrage: '32000', carburant: '80' }, 30000)).toEqual({});
  });

  it('rejette un kilométrage inférieur au dernier connu', () => {
    expect(
      validateOdometerForm({ kilometrage: '29000', carburant: '80' }, 30000).kilometrage
    ).toBe('invalid_number');
  });

  it('accepte un kilométrage égal au dernier connu', () => {
    expect(
      validateOdometerForm({ kilometrage: '30000', carburant: '80' }, 30000).kilometrage
    ).toBeUndefined();
  });

  it('rejette un carburant hors de 0-100', () => {
    expect(validateOdometerForm({ kilometrage: '32000', carburant: '150' }, 30000).carburant).toBe(
      'invalid_number'
    );
    expect(validateOdometerForm({ kilometrage: '32000', carburant: '-5' }, 30000).carburant).toBe(
      'invalid_number'
    );
  });
});

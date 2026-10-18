import { isDriverFormValid, toDriverInput, validateDriverForm, type DriverFormValues } from '../driver-validation';

function makeValues(overrides: Partial<DriverFormValues> = {}): DriverFormValues {
  return {
    prenom: 'Samir',
    nom: 'Tazi',
    cinOuPasseport: 'BK123456',
    numeroPermis: 'B987654',
    telephone: '0661112233',
    ...overrides,
  };
}

describe('validateDriverForm', () => {
  it("n'a aucune erreur pour des valeurs valides", () => {
    expect(isDriverFormValid(validateDriverForm(makeValues()))).toBe(true);
  });

  it('exige le prénom ET le nom', () => {
    expect(validateDriverForm(makeValues({ prenom: '  ' })).prenom).toBe('required');
    expect(validateDriverForm(makeValues({ nom: '' })).nom).toBe('required');
  });

  it("n'exige aucun autre champ", () => {
    const errors = validateDriverForm(makeValues({ cinOuPasseport: '', numeroPermis: '', telephone: '' }));
    expect(isDriverFormValid(errors)).toBe(true);
  });
});

describe('toDriverInput', () => {
  it('compose le nom complet, convertit les champs vides en null et rogne les espaces', () => {
    const input = toDriverInput(makeValues({ prenom: '  Samir ', nom: ' Tazi  ', telephone: '' }));
    expect(input.nomComplet).toBe('Samir Tazi');
    expect(input.prenom).toBe('Samir');
    expect(input.nom).toBe('Tazi');
    expect(input.telephone).toBeNull();
  });
});

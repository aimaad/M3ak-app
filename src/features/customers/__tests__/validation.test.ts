import {
  isFormValid,
  normalizePhone,
  toCustomerInput,
  validateCustomerForm,
  type CustomerFormValues,
} from '../validation';

function makeValues(overrides: Partial<CustomerFormValues> = {}): CustomerFormValues {
  return {
    nomComplet: 'Youssef El Amrani',
    cinOuPasseport: 'BE482913',
    numeroPermis: 'A123456',
    telephone: '+212661234567',
    email: 'youssef@example.com',
    ...overrides,
  };
}

describe('validateCustomerForm', () => {
  it("n'a aucune erreur pour des valeurs valides", () => {
    expect(isFormValid(validateCustomerForm(makeValues()))).toBe(true);
  });

  it('exige le nom complet', () => {
    expect(validateCustomerForm(makeValues({ nomComplet: '  ' })).nomComplet).toBe('required');
  });

  it('accepte les formats marocains courants de téléphone', () => {
    expect(validateCustomerForm(makeValues({ telephone: '+212661234567' })).telephone).toBeUndefined();
    expect(validateCustomerForm(makeValues({ telephone: '0661234567' })).telephone).toBeUndefined();
    expect(validateCustomerForm(makeValues({ telephone: '06 61 23 45 67' })).telephone).toBeUndefined();
  });

  it('rejette un téléphone vide ou mal formé', () => {
    expect(validateCustomerForm(makeValues({ telephone: '' })).telephone).toBe('required');
    expect(validateCustomerForm(makeValues({ telephone: '123' })).telephone).toBe('invalid_phone');
    expect(validateCustomerForm(makeValues({ telephone: '+33661234567' })).telephone).toBe(
      'invalid_phone'
    );
  });

  it("l'e-mail est facultatif mais doit être valide si renseigné", () => {
    expect(validateCustomerForm(makeValues({ email: '' })).email).toBeUndefined();
    expect(validateCustomerForm(makeValues({ email: 'pas-un-email' })).email).toBe('invalid_email');
  });
});

describe('normalizePhone', () => {
  it('retire espaces, points et tirets', () => {
    expect(normalizePhone('06 61.23-45 67')).toBe('0661234567');
  });
});

describe('toCustomerInput', () => {
  it('convertit les champs vides en null', () => {
    const input = toCustomerInput(makeValues({ cinOuPasseport: '', numeroPermis: '', email: '' }));
    expect(input.cinOuPasseport).toBeNull();
    expect(input.numeroPermis).toBeNull();
    expect(input.email).toBeNull();
  });

  it('normalise le téléphone', () => {
    const input = toCustomerInput(makeValues({ telephone: '06 61 23 45 67' }));
    expect(input.telephone).toBe('0661234567');
  });
});

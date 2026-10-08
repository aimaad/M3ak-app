import {
  isSignupFormValid,
  isValidOtpCode,
  normalizeOtpCode,
  validateSignupForm,
  type SignupFormValues,
} from '../validation';

function makeValues(overrides: Partial<SignupFormValues> = {}): SignupFormValues {
  return {
    email: 'moi@exemple.com',
    password: 'motdepasse123',
    confirmPassword: 'motdepasse123',
    ...overrides,
  };
}

describe('validateSignupForm', () => {
  it("n'a aucune erreur pour des valeurs valides", () => {
    expect(isSignupFormValid(validateSignupForm(makeValues()))).toBe(true);
  });

  it('exige un e-mail valide', () => {
    expect(validateSignupForm(makeValues({ email: '' })).email).toBe('required');
    expect(validateSignupForm(makeValues({ email: 'pas-un-email' })).email).toBe('invalid_email');
  });

  it('exige un mot de passe de 6 caractères minimum', () => {
    expect(validateSignupForm(makeValues({ password: '', confirmPassword: '' })).password).toBe(
      'required'
    );
    expect(validateSignupForm(makeValues({ password: '123', confirmPassword: '123' })).password).toBe(
      'too_short'
    );
  });

  it('exige que les deux mots de passe correspondent', () => {
    expect(validateSignupForm(makeValues({ confirmPassword: 'autrechose' })).confirmPassword).toBe(
      'mismatch'
    );
  });
});

describe('normalizeOtpCode', () => {
  it('ne garde que les chiffres, limités à 6', () => {
    expect(normalizeOtpCode('12 34-56')).toBe('123456');
    expect(normalizeOtpCode('1234567890')).toBe('123456');
    expect(normalizeOtpCode('abc123')).toBe('123');
  });
});

describe('isValidOtpCode', () => {
  it('valide un code à exactement 6 chiffres', () => {
    expect(isValidOtpCode('123456')).toBe(true);
  });

  it('rejette un code incomplet ou non numérique', () => {
    expect(isValidOtpCode('12345')).toBe(false);
    expect(isValidOtpCode('12345a')).toBe(false);
    expect(isValidOtpCode('')).toBe(false);
  });
});

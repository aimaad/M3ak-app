import {
  isPasswordChangeFormValid,
  isSignupFormValid,
  isValidOtpCode,
  normalizeOtpCode,
  validatePasswordChangeForm,
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
  it('ne garde que les chiffres, limités à 10 (la longueur réelle varie selon Supabase)', () => {
    expect(normalizeOtpCode('12 34-56')).toBe('123456');
    expect(normalizeOtpCode('72776389')).toBe('72776389');
    expect(normalizeOtpCode('123456789012')).toBe('1234567890');
    expect(normalizeOtpCode('abc123')).toBe('123');
  });
});

describe('validatePasswordChangeForm', () => {
  it("n'a aucune erreur pour des valeurs valides", () => {
    const errors = validatePasswordChangeForm({ password: 'motdepasse123', confirmPassword: 'motdepasse123' });
    expect(isPasswordChangeFormValid(errors)).toBe(true);
  });

  it('exige un mot de passe de 6 caractères minimum', () => {
    expect(validatePasswordChangeForm({ password: '123', confirmPassword: '123' }).password).toBe('too_short');
  });

  it('exige que les deux mots de passe correspondent', () => {
    expect(
      validatePasswordChangeForm({ password: 'motdepasse123', confirmPassword: 'autrechose' }).confirmPassword
    ).toBe('mismatch');
  });
});

describe('isValidOtpCode', () => {
  it('valide un code de 4 à 10 chiffres (6 ou 8 selon la config Supabase)', () => {
    expect(isValidOtpCode('123456')).toBe(true);
    expect(isValidOtpCode('72776389')).toBe(true);
  });

  it('rejette un code trop court ou non numérique', () => {
    expect(isValidOtpCode('123')).toBe(false);
    expect(isValidOtpCode('12345a')).toBe(false);
    expect(isValidOtpCode('')).toBe(false);
  });
});

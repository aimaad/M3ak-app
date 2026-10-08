import { isSignupFormValid, validateSignupForm, type SignupFormValues } from '../validation';

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

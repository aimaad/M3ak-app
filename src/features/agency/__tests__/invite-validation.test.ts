import { isInviteFormValid, validateInviteForm, type InviteFormValues } from '../invite-validation';

function makeValues(overrides: Partial<InviteFormValues> = {}): InviteFormValues {
  return { prenom: 'Sara', nom: 'Idrissi', email: 'sara@exemple.com', role: 'employee', ...overrides };
}

describe('validateInviteForm', () => {
  it("n'a aucune erreur pour des valeurs valides", () => {
    expect(isInviteFormValid(validateInviteForm(makeValues()))).toBe(true);
  });

  it('exige prénom et nom', () => {
    const errors = validateInviteForm(makeValues({ prenom: '', nom: ' ' }));
    expect(errors.prenom).toBe('required');
    expect(errors.nom).toBe('required');
  });

  it('refuse un nom avec des chiffres', () => {
    expect(validateInviteForm(makeValues({ nom: 'Idrissi2' })).nom).toBe('invalid_name');
  });

  it('exige un e-mail valide', () => {
    expect(validateInviteForm(makeValues({ email: '' })).email).toBe('required');
    expect(validateInviteForm(makeValues({ email: 'pas-un-email' })).email).toBe('invalid_email');
  });
});

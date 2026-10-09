import {
  isAgencyDetailsFormValid,
  toAgencyDetailsInput,
  validateAgencyDetailsForm,
  type AgencyDetailsFormValues,
} from '../validation';

function makeValues(overrides: Partial<AgencyDetailsFormValues> = {}): AgencyDetailsFormValues {
  return {
    nom: 'M3ak Demo',
    raisonSociale: 'M3ak SARL',
    email: 'contact@m3ak.ma',
    telephone: '+212522000000',
    adresse: '12 Rue Ibnou Mounir',
    ville: 'Casablanca',
    pays: 'Maroc',
    devise: 'MAD',
    ...overrides,
  };
}

describe('validateAgencyDetailsForm', () => {
  it("n'a aucune erreur pour des valeurs valides", () => {
    expect(isAgencyDetailsFormValid(validateAgencyDetailsForm(makeValues()))).toBe(true);
  });

  it("n'a aucune erreur si les champs facultatifs sont vides", () => {
    const errors = validateAgencyDetailsForm(
      makeValues({ raisonSociale: '', email: '', telephone: '', adresse: '' })
    );
    expect(isAgencyDetailsFormValid(errors)).toBe(true);
  });

  it('exige le nom commercial', () => {
    expect(validateAgencyDetailsForm(makeValues({ nom: '  ' })).nom).toBe('required');
  });

  it("l'e-mail est facultatif mais doit être valide si renseigné", () => {
    expect(validateAgencyDetailsForm(makeValues({ email: '' })).email).toBeUndefined();
    expect(validateAgencyDetailsForm(makeValues({ email: 'pas-un-email' })).email).toBe('invalid_email');
  });
});

describe('toAgencyDetailsInput', () => {
  it('convertit les champs vides en null', () => {
    const input = toAgencyDetailsInput(makeValues({ raisonSociale: '', email: '', telephone: '', adresse: '' }));
    expect(input.raisonSociale).toBeNull();
    expect(input.email).toBeNull();
    expect(input.telephone).toBeNull();
    expect(input.adresse).toBeNull();
  });

  it('utilise Maroc et MAD par défaut si vides', () => {
    const input = toAgencyDetailsInput(makeValues({ pays: '', devise: '' }));
    expect(input.pays).toBe('Maroc');
    expect(input.devise).toBe('MAD');
  });

  it('rogne les espaces', () => {
    const input = toAgencyDetailsInput(makeValues({ nom: '  M3ak Demo  ' }));
    expect(input.nom).toBe('M3ak Demo');
  });
});

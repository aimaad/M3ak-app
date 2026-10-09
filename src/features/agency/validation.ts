export type AgencyDetailsFormValues = {
  nom: string;
  raisonSociale: string;
  email: string;
  telephone: string;
  adresse: string;
  ville: string;
  pays: string;
  devise: string;
};

export type AgencyDetailsFormErrorCode = 'required' | 'invalid_email';

export type AgencyDetailsFormErrors = Partial<Record<'nom' | 'email', AgencyDetailsFormErrorCode>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateAgencyDetailsForm(values: AgencyDetailsFormValues): AgencyDetailsFormErrors {
  const errors: AgencyDetailsFormErrors = {};

  if (!values.nom.trim()) {
    errors.nom = 'required';
  }

  const email = values.email.trim();
  if (email && !EMAIL_PATTERN.test(email)) {
    errors.email = 'invalid_email';
  }

  return errors;
}

export function isAgencyDetailsFormValid(errors: AgencyDetailsFormErrors): boolean {
  return Object.keys(errors).length === 0;
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function toAgencyDetailsInput(values: AgencyDetailsFormValues): {
  nom: string;
  raisonSociale: string | null;
  email: string | null;
  telephone: string | null;
  adresse: string | null;
  ville: string | null;
  pays: string;
  devise: string;
} {
  return {
    nom: values.nom.trim(),
    raisonSociale: emptyToNull(values.raisonSociale),
    email: emptyToNull(values.email),
    telephone: emptyToNull(values.telephone),
    adresse: emptyToNull(values.adresse),
    ville: emptyToNull(values.ville),
    pays: values.pays.trim() || 'Maroc',
    devise: values.devise.trim() || 'MAD',
  };
}

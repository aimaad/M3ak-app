import type { CustomerInput, CustomerType, PreferredLanguage } from './types';

export type CustomerFormValues = {
  prenom: string;
  nom: string;
  cinOuPasseport: string;
  numeroPermis: string;
  telephone: string;
  telephoneSecondaire: string;
  email: string;
  adresse: string;
  ville: string;
  pays: string;
  dateNaissance: string;
  languePreferee: PreferredLanguage | null;
  typeClient: CustomerType;
  raisonSociale: string;
  ice: string;
};

export type CustomerFormErrorCode = 'required' | 'invalid_phone' | 'invalid_email' | 'invalid_date';

export type CustomerFormErrors = Partial<
  Record<'prenom' | 'nom' | 'telephone' | 'email' | 'dateNaissance' | 'raisonSociale', CustomerFormErrorCode>
>;

// Formats marocains courants : +212 6XXXXXXXX / 0[5-7]XXXXXXXX
const MOROCCAN_PHONE = /^(\+212|0)[5-7]\d{8}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizePhone(raw: string): string {
  return raw.trim().replace(/[\s.-]+/g, '');
}

export function validateCustomerForm(values: CustomerFormValues): CustomerFormErrors {
  const errors: CustomerFormErrors = {};

  // Une personne a toujours un prénom ET un nom, saisis séparément. Pour une entreprise, la raison sociale suffit.
  if (values.typeClient !== 'entreprise') {
    if (!values.prenom.trim()) errors.prenom = 'required';
    if (!values.nom.trim()) errors.nom = 'required';
  }

  const phone = normalizePhone(values.telephone);
  if (!phone) {
    errors.telephone = 'required';
  } else if (!MOROCCAN_PHONE.test(phone)) {
    errors.telephone = 'invalid_phone';
  }

  const email = values.email.trim();
  if (email && !EMAIL_PATTERN.test(email)) {
    errors.email = 'invalid_email';
  }

  if (values.dateNaissance.trim() && Number.isNaN(Date.parse(values.dateNaissance.trim()))) {
    errors.dateNaissance = 'invalid_date';
  }

  if (values.typeClient === 'entreprise' && !values.raisonSociale.trim()) {
    errors.raisonSociale = 'required';
  }

  return errors;
}

export function isFormValid(errors: CustomerFormErrors): boolean {
  return Object.keys(errors).length === 0;
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/** Nom affiché partout (listes, contrat, recherche) : « Prénom Nom », ou la raison sociale d'une entreprise sans contact saisi. */
export function fullNameOf(values: Pick<CustomerFormValues, 'prenom' | 'nom' | 'typeClient' | 'raisonSociale'>): string {
  const person = [values.prenom.trim(), values.nom.trim()].filter(Boolean).join(' ');
  return values.typeClient === 'entreprise' ? person || values.raisonSociale.trim() : person;
}

/** Fiche créée avant la séparation prénom / nom : on propose « premier mot = prénom, le reste = nom » (à corriger si besoin). */
export function splitFullName(nomComplet: string): { prenom: string; nom: string } {
  const [first = '', ...rest] = nomComplet.trim().split(/\s+/);
  return rest.length === 0 ? { prenom: '', nom: first } : { prenom: first, nom: rest.join(' ') };
}

export function toCustomerInput(values: CustomerFormValues): CustomerInput {
  return {
    nomComplet: fullNameOf(values),
    prenom: emptyToNull(values.prenom),
    nom: emptyToNull(values.nom),
    cinOuPasseport: emptyToNull(values.cinOuPasseport),
    numeroPermis: emptyToNull(values.numeroPermis),
    telephone: normalizePhone(values.telephone),
    telephoneSecondaire: emptyToNull(values.telephoneSecondaire),
    email: emptyToNull(values.email),
    adresse: emptyToNull(values.adresse),
    ville: emptyToNull(values.ville),
    pays: values.pays.trim() || 'Maroc',
    dateNaissance: emptyToNull(values.dateNaissance),
    languePreferee: values.languePreferee,
    typeClient: values.typeClient,
    raisonSociale: values.typeClient === 'entreprise' ? emptyToNull(values.raisonSociale) : null,
    ice: values.typeClient === 'entreprise' ? emptyToNull(values.ice) : null,
  };
}

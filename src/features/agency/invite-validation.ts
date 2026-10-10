import { validatePersonName, type PersonNameError } from '@/features/auth/names';
import { isValidEmail } from '@/features/auth/validation';

import type { AgencyRole } from './types';

export type InviteFormValues = {
  prenom: string;
  nom: string;
  email: string;
  role: AgencyRole;
};

export type InviteFormErrors = Partial<Record<'prenom' | 'nom' | 'email', PersonNameError | 'required' | 'invalid_email'>>;

export function validateInviteForm(values: InviteFormValues): InviteFormErrors {
  const errors: InviteFormErrors = {};

  const prenomError = validatePersonName(values.prenom);
  if (prenomError) errors.prenom = prenomError;
  const nomError = validatePersonName(values.nom);
  if (nomError) errors.nom = nomError;

  if (!values.email.trim()) {
    errors.email = 'required';
  } else if (!isValidEmail(values.email)) {
    errors.email = 'invalid_email';
  }

  return errors;
}

export function isInviteFormValid(errors: InviteFormErrors): boolean {
  return Object.keys(errors).length === 0;
}

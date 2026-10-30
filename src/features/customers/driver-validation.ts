import type { DriverInput } from './types';

export type DriverFormValues = {
  prenom: string;
  nom: string;
  cinOuPasseport: string;
  numeroPermis: string;
  telephone: string;
};

export type DriverFormErrorCode = 'required';
export type DriverFormErrors = Partial<Record<'prenom' | 'nom', DriverFormErrorCode>>;

export function validateDriverForm(values: DriverFormValues): DriverFormErrors {
  const errors: DriverFormErrors = {};
  if (!values.prenom.trim()) errors.prenom = 'required';
  if (!values.nom.trim()) errors.nom = 'required';
  return errors;
}

export function isDriverFormValid(errors: DriverFormErrors): boolean {
  return Object.keys(errors).length === 0;
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function toDriverInput(values: DriverFormValues): DriverInput {
  const prenom = values.prenom.trim();
  const nom = values.nom.trim();
  return {
    nomComplet: `${prenom} ${nom}`.trim(),
    prenom,
    nom,
    cinOuPasseport: emptyToNull(values.cinOuPasseport),
    numeroPermis: emptyToNull(values.numeroPermis),
    telephone: emptyToNull(values.telephone),
  };
}

import type { DriverInput } from './types';

export type DriverFormValues = {
  nomComplet: string;
  cinOuPasseport: string;
  numeroPermis: string;
  telephone: string;
};

export type DriverFormErrorCode = 'required';
export type DriverFormErrors = Partial<Record<'nomComplet', DriverFormErrorCode>>;

export function validateDriverForm(values: DriverFormValues): DriverFormErrors {
  const errors: DriverFormErrors = {};
  if (!values.nomComplet.trim()) errors.nomComplet = 'required';
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
  return {
    nomComplet: values.nomComplet.trim(),
    cinOuPasseport: emptyToNull(values.cinOuPasseport),
    numeroPermis: emptyToNull(values.numeroPermis),
    telephone: emptyToNull(values.telephone),
  };
}

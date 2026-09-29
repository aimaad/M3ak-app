import type { CustomerInput } from './types';

export type CustomerFormValues = {
  nomComplet: string;
  cinOuPasseport: string;
  numeroPermis: string;
  telephone: string;
  email: string;
};

export type CustomerFormErrorCode = 'required' | 'invalid_phone' | 'invalid_email';

export type CustomerFormErrors = Partial<
  Record<'nomComplet' | 'telephone' | 'email', CustomerFormErrorCode>
>;

// Formats marocains courants : +212 6XXXXXXXX / 0[5-7]XXXXXXXX
const MOROCCAN_PHONE = /^(\+212|0)[5-7]\d{8}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizePhone(raw: string): string {
  return raw.trim().replace(/[\s.-]+/g, '');
}

export function validateCustomerForm(values: CustomerFormValues): CustomerFormErrors {
  const errors: CustomerFormErrors = {};

  if (!values.nomComplet.trim()) {
    errors.nomComplet = 'required';
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

  return errors;
}

export function isFormValid(errors: CustomerFormErrors): boolean {
  return Object.keys(errors).length === 0;
}

export function toCustomerInput(values: CustomerFormValues): CustomerInput {
  return {
    nomComplet: values.nomComplet.trim(),
    cinOuPasseport: values.cinOuPasseport.trim() || null,
    numeroPermis: values.numeroPermis.trim() || null,
    telephone: normalizePhone(values.telephone),
    email: values.email.trim() || null,
  };
}

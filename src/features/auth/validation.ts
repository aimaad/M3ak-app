export type SignupFormValues = {
  email: string;
  password: string;
  confirmPassword: string;
};

export type SignupFormErrorCode = 'required' | 'invalid_email' | 'too_short' | 'mismatch';

export type SignupFormErrors = Partial<
  Record<'email' | 'password' | 'confirmPassword', SignupFormErrorCode>
>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

export function validateSignupForm(values: SignupFormValues): SignupFormErrors {
  const errors: SignupFormErrors = {};

  if (!values.email.trim()) {
    errors.email = 'required';
  } else if (!EMAIL_PATTERN.test(values.email.trim())) {
    errors.email = 'invalid_email';
  }

  if (!values.password) {
    errors.password = 'required';
  } else if (values.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = 'too_short';
  }

  if (!values.confirmPassword) {
    errors.confirmPassword = 'required';
  } else if (values.confirmPassword !== values.password) {
    errors.confirmPassword = 'mismatch';
  }

  return errors;
}

export function isSignupFormValid(errors: SignupFormErrors): boolean {
  return Object.keys(errors).length === 0;
}

export type PasswordChangeValues = { password: string; confirmPassword: string };
export type PasswordChangeErrors = Partial<Record<'password' | 'confirmPassword', SignupFormErrorCode>>;

export function validatePasswordChangeForm(values: PasswordChangeValues): PasswordChangeErrors {
  const errors: PasswordChangeErrors = {};

  if (!values.password) {
    errors.password = 'required';
  } else if (values.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = 'too_short';
  }

  if (!values.confirmPassword) {
    errors.confirmPassword = 'required';
  } else if (values.confirmPassword !== values.password) {
    errors.confirmPassword = 'mismatch';
  }

  return errors;
}

export function isPasswordChangeFormValid(errors: PasswordChangeErrors): boolean {
  return Object.keys(errors).length === 0;
}

// La longueur du code OTP envoyé par Supabase n'est pas garantie à 6 chiffres
// (observé : 8 chiffres avec certaines configurations) — on reste permissif ici,
// la vraie validation a lieu côté serveur via verifyOtp.
const OTP_PATTERN = /^\d{4,10}$/;
const MAX_OTP_LENGTH = 10;

export function normalizeOtpCode(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, MAX_OTP_LENGTH);
}

export function isValidOtpCode(code: string): boolean {
  return OTP_PATTERN.test(code);
}

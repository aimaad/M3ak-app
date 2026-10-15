import { friendlyErrorKey } from '../user-errors';

describe('friendlyErrorKey', () => {
  it('reconnaît une coupure de connexion, quelle que soit la formulation technique', () => {
    for (const message of ['Network request failed', 'Failed to fetch', 'Failed to send a request to the Edge Function', 'timeout of 5000ms exceeded', 'fetch failed']) {
      expect(friendlyErrorKey(new Error(message))).toBe('errors.network');
    }
  });

  it('traduit les erreurs de connexion et de création de compte', () => {
    expect(friendlyErrorKey(new Error('Invalid login credentials'))).toBe('auth.invalidCredentials');
    expect(friendlyErrorKey(new Error('Email not confirmed'))).toBe('errors.emailNotConfirmed');
    expect(friendlyErrorKey(new Error('User already registered'))).toBe('errors.alreadyRegistered');
    expect(friendlyErrorKey(new Error('Password should be at least 6 characters'))).toBe('errors.weakPassword');
  });

  it('traduit trop de tentatives et manque de droits', () => {
    expect(friendlyErrorKey({ message: 'email rate limit exceeded' })).toBe('errors.rateLimit');
    expect(friendlyErrorKey({ message: 'new row violates row-level security policy for table "x"' })).toBe('errors.permission');
    expect(friendlyErrorKey({ message: 'not_allowed' })).toBe('errors.permission');
  });

  it("utilise le message de repli, jamais le texte technique, quand l'erreur est inconnue", () => {
    expect(friendlyErrorKey(new Error('duplicate key value violates unique constraint "x_pkey"'))).toBe('errors.generic');
    expect(friendlyErrorKey(new Error('boom'), 'onboarding.createError')).toBe('onboarding.createError');
    expect(friendlyErrorKey(null)).toBe('errors.generic');
  });
});

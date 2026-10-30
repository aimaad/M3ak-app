import { errorReference, friendlyErrorKey, userErrorMessage } from '../user-errors';

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

describe('envoi d\'e-mail et erreurs serveur', () => {
  it('reconnaît un échec d\'envoi d\'e-mail', () => {
    for (const message of ['Error sending confirmation email', 'Email address not authorized', 'unexpected_failure', '421 4.4.5 Server busy (smtp.gmail.com)']) {
      expect(friendlyErrorKey(new Error(message))).toBe('errors.emailSend');
    }
  });
  it('reconnaît une panne serveur', () => {
    expect(friendlyErrorKey({ message: 'Internal Server Error', status: 500 })).toBe('errors.server');
    expect(friendlyErrorKey(new Error('Database error saving new user'))).toBe('errors.server');
  });
});

describe('errorReference', () => {
  it('utilise le code ou le statut', () => {
    expect(errorReference({ code: 'unexpected_failure', message: 'x' })).toBe('unexpected_failure');
    expect(errorReference({ status: 500 })).toBe('500');
  });
  it('reprend le mot-clé d\'une erreur SQL', () => {
    expect(errorReference(new Error('invite_email_mismatch'))).toBe('invite_email_mismatch');
  });
  it('ne reprend jamais du texte libre', () => {
    expect(errorReference(new Error('Impossible de joindre karim@mail.ma'))).toBeNull();
    expect(errorReference('texte')).toBeNull();
  });
});

describe('userErrorMessage', () => {
  const t = (key: string, options?: Record<string, unknown>) => (options ? `${key}|${JSON.stringify(options)}` : key);
  it('ajoute la référence quand la cause est inconnue', () => {
    expect(userErrorMessage({ code: 'weird_code' }, t)).toBe('errors.generic errors.reference|{"reference":"weird_code"}');
  });
  it('n\'ajoute pas de référence à une erreur déjà expliquée', () => {
    expect(userErrorMessage(new Error('Network request failed'), t)).toBe('errors.network');
  });
});

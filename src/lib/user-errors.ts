/**
 * Traduit une erreur technique (réseau, authentification, droits…) en clé de message compréhensible par un
 * utilisateur non technicien : jamais de code, de numéro ni de texte anglais affiché à l'écran.
 * Les détails techniques restent côté développeur (journaux de la console), pas dans l'interface.
 */
function messageOf(error: unknown): string {
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null) {
    const { message, code } = error as { message?: unknown; code?: unknown };
    return `${typeof message === 'string' ? message : ''} ${typeof code === 'string' ? code : ''}`.trim();
  }
  return '';
}

export function friendlyErrorKey(error: unknown, fallback = 'errors.generic'): string {
  const text = messageOf(error).toLowerCase();

  if (/network request failed|failed to fetch|fetch failed|network error|networkerror|timed out|timeout|enotfound|econnrefused|internet|load failed|failed to send a request/.test(text)) {
    return 'errors.network';
  }
  if (/invalid login credentials|invalid_credentials/.test(text)) return 'auth.invalidCredentials';
  if (/email not confirmed|email_not_confirmed/.test(text)) return 'errors.emailNotConfirmed';
  if (/already registered|already been registered|user_already_exists|email_exists/.test(text)) return 'errors.alreadyRegistered';
  if (/password should be|weak_password|password is too|at least \d+ characters/.test(text)) return 'errors.weakPassword';
  if (/error sending (confirmation |magic link |recovery )?(e-?mail|otp)|sending (confirmation|recovery) email|email address not authorized|smtp|unexpected_failure/.test(text)) {
    return 'errors.emailSend';
  }
  if (/rate limit|rate_limit|too many requests|over_email_send_rate_limit|over_request_rate_limit|\b429\b/.test(text)) {
    return 'errors.rateLimit';
  }
  if (/row-level security|permission denied|not_allowed|insufficient_privilege|\b42501\b|\b403\b/.test(text)) {
    return 'errors.permission';
  }
  if (/internal server error|database error|\b5\d\d\b|bad gateway|service unavailable/.test(text)) return 'errors.server';
  return fallback;
}

/**
 * Courte référence technique à montrer en petit sous un message d'erreur (« Réf. : unexpected_failure »), pour que le
 * support comprenne tout de suite. Uniquement un code ou un statut : jamais de texte libre ni de donnée personnelle.
 */
export function errorReference(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null;
  const { code, status, message } = error as { code?: unknown; status?: unknown; message?: unknown };
  const candidates: unknown[] = [code, status];
  // Les erreurs de nos fonctions SQL sont des mots-clés (« invite_email_mismatch ») dans le message.
  if (typeof message === 'string' && /^[a-z][a-z0-9_]{2,40}$/.test(message.trim())) candidates.push(message.trim());
  for (const value of candidates) {
    const text = typeof value === 'number' ? String(value) : typeof value === 'string' ? value : '';
    const clean = text.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);
    if (clean) return clean;
  }
  return null;
}

const KEYS_WITH_REFERENCE = new Set(['errors.generic', 'errors.server', 'errors.emailSend']);

/** Message lisible pour l'écran ; ajoute la référence technique seulement quand la cause n'est pas expliquée au lecteur. */
export function userErrorMessage(error: unknown, t: (key: string, options?: Record<string, unknown>) => string, fallback = 'errors.generic'): string {
  const key = friendlyErrorKey(error, fallback);
  const reference = KEYS_WITH_REFERENCE.has(key) || key === fallback ? errorReference(error) : null;
  return reference ? `${t(key)} ${t('errors.reference', { reference })}` : t(key);
}

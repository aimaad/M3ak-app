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
  if (/rate limit|rate_limit|too many requests|over_email_send_rate_limit|over_request_rate_limit|\b429\b/.test(text)) {
    return 'errors.rateLimit';
  }
  if (/row-level security|permission denied|not_allowed|insufficient_privilege|\b42501\b|\b403\b/.test(text)) {
    return 'errors.permission';
  }
  return fallback;
}

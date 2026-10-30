const KNOWN_INVITE_ERRORS = [
  'not_allowed',
  'not_authenticated',
  'role_not_allowed',
  'invalid_email',
  'invalid_name',
  'branch_access_denied',
  'branch_must_belong_to_same_agency',
  'already_member',
  'invite_already_pending',
  'invite_not_pending',
  'invite_not_found',
  'invite_invalid_or_expired',
  'invite_email_mismatch',
  'email_not_confirmed',
] as const;

/** Clé i18n d'un refus de création / renvoi / annulation / acceptation d'invitation. */
export function inviteErrorKey(error: unknown): string {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const code = KNOWN_INVITE_ERRORS.find((known) => message.includes(known));
  return `equipe.invite.errors.${code ?? 'generic'}`;
}

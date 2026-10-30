// Le code d'invitation est généré par le serveur (12 caractères, voir la migration
// 0026) : l'app ne fait que l'afficher, le partager et le saisir.
export const INVITE_VALIDITY_DAYS = 7;
export const INVITE_CODE_LENGTH = 12;

/** Majuscules, sans tirets ni espaces : « abcd-efgh-jk23 » → « ABCDEFGHJK23 ». */
export function normalizeInviteCode(raw: string): string {
  return raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, INVITE_CODE_LENGTH);
}

/** Affichage lisible par blocs de 4 : « ABCD-EFGH-JK23 ». */
export function formatInviteCode(code: string): string {
  return normalizeInviteCode(code).replace(/(.{4})(?=.)/g, '$1-');
}

export function isValidInviteCode(raw: string): boolean {
  return normalizeInviteCode(raw).length === INVITE_CODE_LENGTH;
}

export function isInviteExpired(expiresAt: string, now: Date = new Date()): boolean {
  return new Date(expiresAt).getTime() <= now.getTime();
}

export type InviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export function inviteStatus(
  invite: { usedAt: string | null; revokedAt: string | null; expiresAt: string },
  now: Date = new Date()
): InviteStatus {
  if (invite.usedAt) return 'accepted';
  if (invite.revokedAt) return 'revoked';
  if (isInviteExpired(invite.expiresAt, now)) return 'expired';
  return 'pending';
}

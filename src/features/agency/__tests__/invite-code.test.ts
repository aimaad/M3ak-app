import {
  formatInviteCode,
  inviteStatus,
  isInviteExpired,
  isValidInviteCode,
  normalizeInviteCode,
} from '../invite-code';

describe('normalizeInviteCode', () => {
  it('met en majuscules et retire tirets et espaces', () => {
    expect(normalizeInviteCode(' abcd-efgh jk23 ')).toBe('ABCDEFGHJK23');
  });

  it('limite à 12 caractères', () => {
    expect(normalizeInviteCode('ABCDEFGHJK23XXXX')).toBe('ABCDEFGHJK23');
  });
});

describe('formatInviteCode', () => {
  it('découpe en blocs de 4', () => {
    expect(formatInviteCode('abcdefghjk23')).toBe('ABCD-EFGH-JK23');
  });
});

describe('isValidInviteCode', () => {
  it('exige 12 caractères utiles', () => {
    expect(isValidInviteCode('ABCD-EFGH-JK23')).toBe(true);
    expect(isValidInviteCode('ABCD-EFGH')).toBe(false);
    expect(isValidInviteCode('')).toBe(false);
  });
});

describe('isInviteExpired', () => {
  it("n'est pas expiré avant la date limite", () => {
    expect(isInviteExpired('2026-02-01T00:00:00.000Z', new Date('2026-01-15T00:00:00.000Z'))).toBe(false);
  });

  it('est expiré après la date limite', () => {
    expect(isInviteExpired('2026-01-01T00:00:00.000Z', new Date('2026-01-15T00:00:00.000Z'))).toBe(true);
  });
});

describe('inviteStatus', () => {
  const now = new Date('2026-01-15T00:00:00.000Z');
  const base = { usedAt: null, revokedAt: null, expiresAt: '2026-02-01T00:00:00.000Z' };

  it('en attente', () => {
    expect(inviteStatus(base, now)).toBe('pending');
  });

  it('acceptée prime sur le reste', () => {
    expect(inviteStatus({ ...base, usedAt: '2026-01-10T00:00:00.000Z', revokedAt: 'x' }, now)).toBe('accepted');
  });

  it('annulée', () => {
    expect(inviteStatus({ ...base, revokedAt: '2026-01-10T00:00:00.000Z' }, now)).toBe('revoked');
  });

  it('expirée', () => {
    expect(inviteStatus({ ...base, expiresAt: '2026-01-01T00:00:00.000Z' }, now)).toBe('expired');
  });
});

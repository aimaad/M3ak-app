import { generateInviteCode, inviteExpiryDate, isInviteExpired } from '../invite-code';

describe('generateInviteCode', () => {
  it('génère un code de 6 caractères', () => {
    expect(generateInviteCode()).toHaveLength(6);
  });

  it("n'utilise jamais de caractères ambigus (0, O, 1, I, L)", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateInviteCode()).not.toMatch(/[0O1IL]/);
    }
  });

  it('est déterministe avec une source aléatoire fixe', () => {
    const fixedRandom = () => 0;
    expect(generateInviteCode(fixedRandom)).toBe('AAAAAA');
  });
});

describe('inviteExpiryDate', () => {
  it('ajoute 7 jours à la date donnée', () => {
    const from = new Date('2026-01-01T00:00:00.000Z');
    const expiry = inviteExpiryDate(from);
    expect(expiry.toISOString()).toBe('2026-01-08T00:00:00.000Z');
  });
});

describe('isInviteExpired', () => {
  it("n'est pas expiré avant la date limite", () => {
    expect(isInviteExpired('2026-02-01T00:00:00.000Z', new Date('2026-01-15T00:00:00.000Z'))).toBe(
      false
    );
  });

  it('est expiré après la date limite', () => {
    expect(isInviteExpired('2026-01-01T00:00:00.000Z', new Date('2026-01-15T00:00:00.000Z'))).toBe(
      true
    );
  });
});

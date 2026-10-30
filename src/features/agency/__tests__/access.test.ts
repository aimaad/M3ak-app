import { daysLeft, parseAgencyAccess, shouldShowTrialBanner } from '../access';

const NOW = new Date('2030-01-10T12:00:00Z');

describe('parseAgencyAccess', () => {
  it('lit une réponse valide', () => {
    expect(
      parseAgencyAccess({ agency_id: 'a1', access_until: '2030-01-15T00:00:00Z', suspended: false, has_access: true })
    ).toEqual({ agencyId: 'a1', accessUntil: '2030-01-15T00:00:00Z', suspended: false, hasAccess: true });
  });

  it('renvoie null sans agence', () => {
    expect(parseAgencyAccess(null)).toBeNull();
    expect(parseAgencyAccess({})).toBeNull();
  });

  it('refuse par défaut si has_access est absent', () => {
    expect(parseAgencyAccess({ agency_id: 'a1' })?.hasAccess).toBe(false);
  });
});

describe('daysLeft', () => {
  it('null si illimité', () => expect(daysLeft(null, NOW)).toBeNull());
  it('arrondit au jour supérieur', () => expect(daysLeft('2030-01-15T11:00:00Z', NOW)).toBe(5));
  it('jamais négatif', () => expect(daysLeft('2030-01-01T00:00:00Z', NOW)).toBe(0));
});

describe('shouldShowTrialBanner', () => {
  const base = { agencyId: 'a', accessUntil: '2030-01-15T00:00:00Z', suspended: false, hasAccess: true };
  it('visible pendant l\'essai', () => expect(shouldShowTrialBanner(base)).toBe(true));
  it('caché si illimité', () => expect(shouldShowTrialBanner({ ...base, accessUntil: null })).toBe(false));
  it('caché si l\'accès est fermé', () => expect(shouldShowTrialBanner({ ...base, hasAccess: false })).toBe(false));
  it('caché sans agence', () => expect(shouldShowTrialBanner(null)).toBe(false));
});

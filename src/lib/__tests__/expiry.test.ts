import { computeExpiryUrgency } from '../expiry';

describe('computeExpiryUrgency', () => {
  const today = new Date('2026-06-15T00:00:00Z');

  it('retourne null sans date d\'expiration', () => {
    expect(computeExpiryUrgency(null, today)).toBeNull();
  });

  it('retourne "expire" pour une date passée', () => {
    expect(computeExpiryUrgency('2026-06-01T00:00:00Z', today)).toBe('expire');
  });

  it('retourne "bientot" dans la fenêtre des jours proches', () => {
    expect(computeExpiryUrgency('2026-06-30T00:00:00Z', today, 30)).toBe('bientot');
  });

  it('retourne "ok" largement avant l\'échéance', () => {
    expect(computeExpiryUrgency('2026-12-01T00:00:00Z', today, 30)).toBe('ok');
  });

  it('respecte une fenêtre dueSoonDays personnalisée', () => {
    expect(computeExpiryUrgency('2026-06-20T00:00:00Z', today, 3)).toBe('ok');
    expect(computeExpiryUrgency('2026-06-17T00:00:00Z', today, 3)).toBe('bientot');
  });
});

import { buildGettingStarted, dismissKey, progressOf, shouldShowGettingStarted } from '../getting-started';

const base = { hasLogo: false, vehicleCount: 0, customerCount: 0, rentalCount: 0 };

describe('buildGettingStarted', () => {
  it('propose 5 étapes au propriétaire, la première déjà cochée', () => {
    const steps = buildGettingStarted({ ...base, role: 'owner' });
    expect(steps?.map((s) => s.key)).toEqual(['joined', 'logo', 'vehicle', 'customer', 'rental']);
    expect(steps?.[0].done).toBe(true);
    expect(progressOf(steps ?? [])).toEqual({ done: 1, total: 5 });
  });

  it("ne propose pas le logo au responsable", () => {
    const steps = buildGettingStarted({ ...base, role: 'manager' });
    expect(steps?.map((s) => s.key)).toEqual(['joined', 'vehicle', 'customer', 'rental']);
  });

  it("n'affiche rien à l'employé", () => {
    expect(buildGettingStarted({ ...base, role: 'employee' })).toBeNull();
    expect(buildGettingStarted({ ...base, role: null })).toBeNull();
  });

  it('coche les étapes selon les données', () => {
    const steps = buildGettingStarted({ role: 'owner', hasLogo: true, vehicleCount: 2, customerCount: 0, rentalCount: 0 });
    expect(steps?.filter((s) => s.done).map((s) => s.key)).toEqual(['joined', 'logo', 'vehicle']);
  });

  it('chaque étape à faire pointe vers son écran', () => {
    const steps = buildGettingStarted({ ...base, role: 'owner' }) ?? [];
    expect(steps.map((s) => s.href)).toEqual([null, '/entreprise', '/flotte/nouveau', '/clients/nouveau', '/locations/nouveau']);
  });
});

describe('shouldShowGettingStarted', () => {
  const steps = buildGettingStarted({ ...base, role: 'owner' });
  it('visible tant que tout n\'est pas fait', () => expect(shouldShowGettingStarted(steps, false)).toBe(true));
  it('masquée par l\'utilisateur', () => expect(shouldShowGettingStarted(steps, true)).toBe(false));
  it('disparaît quand tout est fait', () => {
    const done = buildGettingStarted({ role: 'owner', hasLogo: true, vehicleCount: 1, customerCount: 1, rentalCount: 1 });
    expect(shouldShowGettingStarted(done, false)).toBe(false);
  });
  it('jamais pour un employé', () => expect(shouldShowGettingStarted(null, false)).toBe(false));
});

describe('dismissKey', () => {
  it('est propre à la personne et à l\'agence', () => {
    expect(dismissKey('u1', 'a1')).not.toBe(dismissKey('u2', 'a1'));
    expect(dismissKey('u1', 'a1')).not.toBe(dismissKey('u1', 'a2'));
  });
  it('est nulle sans identifiants', () => {
    expect(dismissKey(undefined, 'a1')).toBeNull();
    expect(dismissKey('u1', undefined)).toBeNull();
  });
});

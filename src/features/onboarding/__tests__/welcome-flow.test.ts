import { buildGettingStarted } from '../getting-started';
import { currentWelcomeScreen, shouldAutoOpenWelcome, welcomeSeenKey, welcomeSteps } from '../welcome-flow';

const fresh = { hasLogo: false, vehicleCount: 0, customerCount: 0, rentalCount: 0 };
const owner = (over: Partial<typeof fresh> = {}) => buildGettingStarted({ role: 'owner', ...fresh, ...over });

describe('welcomeSteps', () => {
  it('retire « joined » et garde l\'ordre', () => {
    expect(welcomeSteps(owner()).map((s) => s.key)).toEqual(['logo', 'vehicle', 'customer', 'rental']);
  });
  it('vide sans étapes (employé)', () => expect(welcomeSteps(null)).toEqual([]));
});

describe('currentWelcomeScreen', () => {
  it('commence par l\'écran d\'accueil avec le nombre d\'étapes à faire', () => {
    expect(currentWelcomeScreen(owner(), false, [])).toEqual({ kind: 'intro', total: 4 });
  });

  it('montre la première étape à faire, position et total', () => {
    const screen = currentWelcomeScreen(owner(), true, []);
    expect(screen).toMatchObject({ kind: 'step', position: 1, total: 4 });
    expect(screen.kind === 'step' && screen.step.key).toBe('logo');
  });

  it('passe tout seul à l\'étape suivante quand une étape est faite', () => {
    const screen = currentWelcomeScreen(owner({ hasLogo: true, vehicleCount: 1 }), true, []);
    expect(screen.kind === 'step' && screen.step.key).toBe('customer');
    expect(screen).toMatchObject({ position: 3, total: 4 });
  });

  it('saute les étapes passées volontairement', () => {
    const screen = currentWelcomeScreen(owner(), true, ['logo', 'vehicle']);
    expect(screen.kind === 'step' && screen.step.key).toBe('customer');
  });

  it('termine quand tout est fait ou passé, en comptant les étapes passées', () => {
    expect(currentWelcomeScreen(owner({ hasLogo: true, vehicleCount: 1, customerCount: 1, rentalCount: 1 }), true, [])).toEqual({ kind: 'done', skipped: 0 });
    expect(currentWelcomeScreen(owner(), true, ['logo', 'vehicle', 'customer', 'rental'])).toEqual({ kind: 'done', skipped: 4 });
  });

  it('le responsable n\'a pas l\'étape du logo', () => {
    const manager = buildGettingStarted({ role: 'manager', ...fresh });
    expect(currentWelcomeScreen(manager, false, [])).toEqual({ kind: 'intro', total: 3 });
  });
});

describe('shouldAutoOpenWelcome', () => {
  const base = { steps: owner(), seen: false as boolean | null, vehicleCount: 0, customerCount: 0, rentalCount: 0 };
  it('s\'ouvre pour une agence vide jamais accueillie', () => expect(shouldAutoOpenWelcome(base)).toBe(true));
  it('jamais deux fois', () => expect(shouldAutoOpenWelcome({ ...base, seen: true })).toBe(false));
  it('attend la lecture de la mémoire (null)', () => expect(shouldAutoOpenWelcome({ ...base, seen: null })).toBe(false));
  it('ne dérange pas une agence déjà utilisée', () => {
    expect(shouldAutoOpenWelcome({ ...base, vehicleCount: 1 })).toBe(false);
    expect(shouldAutoOpenWelcome({ ...base, rentalCount: 2 })).toBe(false);
  });
  it('jamais pour un employé', () => expect(shouldAutoOpenWelcome({ ...base, steps: null })).toBe(false));
});

describe('welcomeSeenKey', () => {
  it('est propre à la personne et à l\'agence', () => {
    expect(welcomeSeenKey('u1', 'a1')).not.toBe(welcomeSeenKey('u1', 'a2'));
    expect(welcomeSeenKey(undefined, 'a1')).toBeNull();
  });
});

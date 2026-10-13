// Tests de la console d'administration web : calculs purs + garde-fous statiques de sécurité.
const fs = require('node:fs');
const path = require('node:path');

const { adminErrorMessage, costLabel, isValidCode, isValidEmail, normalizeCode, parseDecimal, periodRange, summarize, validateKey, validateNewPassword } = require('../format.js');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const squash = (text) => text.replace(/[\s  ]/g, ' ');

describe('summarize', () => {
  it('additionne les analyses, les tokens et le coût, et signale un coût incomplet', () => {
    const total = summarize([
      { key_set: true, cloud_enabled: true, scans: 10, scans_failed: 2, input_tokens: 1000, output_tokens: 100, cost_usd: 0.5 },
      { key_set: true, cloud_enabled: false, scans: 3, scans_failed: 0, input_tokens: 500, output_tokens: 50, cost_usd: 0 },
      { key_set: false, cloud_enabled: false, scans: 0, scans_failed: 0, input_tokens: 0, output_tokens: 0, cost_usd: 0 },
    ]);
    expect(total).toMatchObject({ agencies: 3, withKey: 2, enabled: 1, scans: 13, failed: 2, inputTokens: 1500, outputTokens: 150, costUsd: 0.5, costComplete: true });
    expect(summarize([{ key_set: true, key_tier: 'paid', cost_usd: null }]).costComplete).toBe(false);
  });
});

describe('coût affiché', () => {
  it('ne montre jamais un coût inventé : « tarif non configuré » tant que le tarif manque', () => {
    expect(costLabel({ key_set: true, key_tier: 'paid', cost_usd: null, scans: 4 }, null)).toBe('Tarif non configuré');
  });
  it('clé gratuite : 0 ; payante : USD et MAD', () => {
    expect(costLabel({ key_set: true, key_tier: 'free', cost_usd: 0, scans: 4 }, 10)).toBe('Gratuit (0)');
    expect(squash(costLabel({ key_set: true, key_tier: 'paid', cost_usd: 0.7, scans: 4 }, 10))).toContain('7,00 MAD');
  });
});

describe('saisies', () => {
  it('valide la clé comme le serveur', () => {
    expect(validateKey('')).toBe('required');
    expect(validateKey('court')).toBe('format');
    expect(validateKey('AQ.avec des espaces 0123456789')).toBe('format');
    expect(validateKey('  AQ.fake-test-key-0123456789abcdef ')).toBeNull();
  });
  it('lit les décimaux avec virgule ou point', () => {
    expect(parseDecimal('0,30')).toBe(0.3);
    expect(parseDecimal('2.5')).toBe(2.5);
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('abc')).toBeNaN();
    expect(parseDecimal('-1')).toBeNaN();
  });
  it('calcule la période', () => {
    const now = new Date(2026, 9, 13, 12);
    expect(periodRange('all', now)).toEqual({ from: null, to: null });
    expect(new Date(periodRange('month', now).from).getDate()).toBeLessThanOrEqual(2);
    expect(periodRange('30d', now).from).toBeTruthy();
  });
  it('traduit les erreurs serveur', () => {
    expect(adminErrorMessage({ message: 'not_allowed' })).toMatch(/administrateurs/);
    expect(adminErrorMessage({ message: 'invalid_key_format' })).toMatch(/invalide/);
  });
});

describe('mot de passe oublié', () => {
  it('valide e-mail, code et nouveau mot de passe', () => {
    expect(isValidEmail('admin@m3ak.ma')).toBe(true);
    expect(isValidEmail('pas un email')).toBe(false);
    expect(normalizeCode(' 12 34-56 ')).toBe('123456');
    expect(isValidCode('123456')).toBe(true);
    expect(isValidCode('12')).toBe(false);
    expect(validateNewPassword('court', 'court')).toMatch(/8 caractères/);
    expect(validateNewPassword('MotDePasse-2026', 'autre')).toMatch(/ne correspondent pas/);
    expect(validateNewPassword('MotDePasse-2026', 'MotDePasse-2026')).toBeNull();
  });
  it('utilise le code reçu par e-mail (type recovery) puis change le mot de passe, sans révéler si le compte existe', () => {
    const app = read('app.js');
    expect(app).toContain("resetPasswordForEmail(email.value.trim())");
    expect(app).toMatch(/verifyOtp\(\{ email: emailAddress, token: code\.value, type: 'recovery' \}\)/);
    expect(app.indexOf('verifyOtp')).toBeLessThan(app.indexOf('updateUser'));
    expect(app).toContain('Si un compte existe pour cette adresse');
  });
});

describe('garde-fous de sécurité de la console', () => {
  const app = read('app.js');
  const html = read('index.html');

  it("n'insère jamais de texte de la base comme HTML (anti-XSS)", () => {
    expect(app).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(/);
  });
  it('contient une politique CSP stricte et aucun script en ligne', () => {
    expect(html).toContain('Content-Security-Policy');
    expect(html).toContain("default-src 'none'");
    expect(html).not.toMatch(/<script(?![^>]*src=)/);
    expect(html).not.toMatch(/\son[a-z]+=/i);
  });
  it('la clé est un champ mot de passe, jamais relue ni stockée', () => {
    expect(html).toMatch(/id="key-input" type="password"/);
    expect(app).not.toMatch(/localStorage/);
    expect(app).toContain('window.sessionStorage');
    expect(app).not.toMatch(/gemini_api_key|service_role/i);
  });
  it("n'embarque aucune clé secrète : modèle de config avec valeurs factices, config réelle ignorée par git", () => {
    const example = read('config.example.js');
    expect(example).toContain('VOTRE_CLE_ANON_PUBLIQUE');
    expect(fs.existsSync(path.join(__dirname, '..', 'config.js'))).toBe(false);
    expect(fs.readFileSync(path.join(__dirname, '..', '..', '.gitignore'), 'utf8')).toContain('admin-web/config.js');
  });
  it("n'appelle que les fonctions d'administration contrôlées côté serveur", () => {
    const rpcs = [...app.matchAll(/rpc\('([a-z_]+)'/g)].map((m) => m[1]).sort();
    expect([...new Set(rpcs)]).toEqual(['admin_clear_ocr_key', 'admin_ocr_overview', 'admin_set_ocr_key', 'admin_set_ocr_key_tier', 'admin_set_ocr_pricing', 'is_platform_admin']);
    expect(app).not.toMatch(/\.from\(/);
  });
});

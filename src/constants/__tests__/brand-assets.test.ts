// Même convention que les autres garde-fous statiques du projet (pas de types Node dans l'app).
declare const __dirname: string;
declare function require(name: string): any;
declare const Buffer: any;
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const root: string = path.resolve(__dirname, '../../..');
const read = (file: string): any => fs.readFileSync(path.join(root, file));

/** Empreinte du PNG intégré au logo officiel fourni : il ne doit jamais changer. */
const OFFICIAL_LOGO_PNG_SHA256 = '5d024c7bd8fcd2bd73e642e48b26ef78880309f6d3d702856ae115da1d1c4cc5';

describe('logo officiel BIBIP', () => {
  it('le fichier source fourni est conservé tel quel (PNG intégré inchangé)', () => {
    const svg = read('assets/branding/BIBIP_logo_exact.svg').toString('utf8');
    const match = /data:image\/png;base64,([A-Za-z0-9+/=]+)/.exec(svg);
    expect(match).not.toBeNull();
    const png = Buffer.from(match![1], 'base64');
    expect(createHash('sha256').update(png).digest('hex')).toBe(OFFICIAL_LOGO_PNG_SHA256);
  });

  it("les fichiers de l'app existent et les anciens logos ont disparu", () => {
    for (const file of [
      'logo-bibip.png',
      'icon.png',
      'splash-icon.png',
      'favicon.png',
      'android-icon-foreground.png',
      'android-icon-background.png',
      'android-icon-monochrome.png',
    ]) {
      expect(fs.existsSync(path.join(root, 'assets/images', file))).toBe(true);
    }
    const images = fs.readdirSync(path.join(root, 'assets/images'));
    expect(images.filter((name: string) => /m3ak|tutut|kriha/i.test(name))).toEqual([]);
  });

  it("les images du scénario d'ouverture fournies sont présentes", () => {
    for (const file of [
      'front-lit.webp',
      'front-unlit.webp',
      'three-quarter.webp',
      'showroom.webp',
    ]) {
      expect(fs.existsSync(path.join(root, 'assets/images/signature', file))).toBe(true);
    }
    expect(fs.existsSync(path.join(root, 'assets/images/ignition'))).toBe(false);
  });

  it("le nom affiché de l'application est BIBIP (identifiants techniques inchangés)", () => {
    const app = JSON.parse(read('app.json').toString('utf8')).expo;
    expect(app.name).toBe('BIBIP');
    expect(app.slug).toBe('m3ak');
    expect(app.scheme).toBe('m3ak');
    expect(
      app.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'expo-splash-screen')[1]
        .backgroundColor
    ).toBe('#FAF8F1');
  });
});

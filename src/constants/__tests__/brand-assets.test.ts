// Même convention que les autres garde-fous statiques du projet (pas de types Node dans l'app).
declare const __dirname: string;
declare function require(name: string): any;
declare const Buffer: any;
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const root: string = path.resolve(__dirname, '../../..');
const read = (file: string): any => fs.readFileSync(path.join(root, file));

/** Empreintes des deux fichiers du symbole (gris pour fond clair, blanc pour fond sombre) : ils ne doivent jamais changer. */
const SYMBOL_SHA256 = {
  'bibip-symbole-gris.svg': '0e7212b4cbf674e37eae6022239e1cc1cec77c73fadf0a9fd8b40a25fad81288',
  'bibip-symbole-blanc.svg': '8ac2598c1626ba106640c19b23839841096e41d5b2b60451e94d6a18b8072a4c',
};

describe('logo BIBIP (symbole « b » + deux ondes orange)', () => {
  it('les fichiers du symbole sont conservés tels quels', () => {
    for (const [file, hash] of Object.entries(SYMBOL_SHA256)) {
      expect(createHash('sha256').update(read(`assets/images/${file}`)).digest('hex')).toBe(hash);
    }
  });

  it("le symbole utilise graphite ou blanc pour le « b » et l'orange de la marque pour les ondes", () => {
    const gris = read('assets/images/bibip-symbole-gris.svg').toString('utf8');
    const blanc = read('assets/images/bibip-symbole-blanc.svg').toString('utf8');
    expect(gris).toContain('#202527');
    expect(gris).toContain('#CA531D');
    expect(blanc).toContain('#FFFFFF');
    expect(blanc).toContain('#CA531D');
  });

  it("les fichiers de l'app existent et les anciens logos ont disparu", () => {
    for (const file of [
      'icon.png',
      'splash-icon.png',
      'favicon.png',
      'android-icon-foreground.png',
      'android-icon-background.png',
      'android-icon-monochrome.png',
    ]) {
      expect(fs.existsSync(path.join(root, 'assets/images', file))).toBe(true);
    }
    expect(fs.existsSync(path.join(root, 'assets/branding/BIBIP_logo_exact.svg'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'assets/images/logo-bibip.png'))).toBe(false);
    const images = fs.readdirSync(path.join(root, 'assets/images'));
    expect(images.filter((name: string) => /m3ak|tutut|kriha/i.test(name))).toEqual([]);
  });

  it("la vidéo d'ouverture est présente et l'ancienne ouverture (photos, son) a disparu", () => {
    expect(fs.existsSync(path.join(root, 'assets/video/bibip-intro-vertical-court.mp4'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'assets/images/ignition'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'assets/audio'))).toBe(false);
    for (const file of ['signature/showroom.webp', 'signature/three-quarter.webp']) {
      expect(fs.existsSync(path.join(root, 'assets/images', file))).toBe(true);
    }
  });

  it("le nom affiché de l'application est BIBIP (identifiants techniques inchangés)", () => {
    const app = JSON.parse(read('app.json').toString('utf8')).expo;
    expect(app.name).toBe('BIBIP');
    expect(app.slug).toBe('m3ak');
    expect(app.scheme).toBe('m3ak');
    expect(
      app.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'expo-splash-screen')[1]
        .backgroundColor
    ).toBe('#000000');
    expect(app.android.adaptiveIcon.backgroundColor).toBe('#202527');
    expect(app.userInterfaceStyle).toBe('light');
  });
});

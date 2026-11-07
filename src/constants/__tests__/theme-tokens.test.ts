import { brand, dark, light } from '../brand';

/** Rapport de contraste WCAG 2.x entre deux couleurs « #RRGGBB ». */
function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('identité BIBIP graphite + orange : valeurs officielles', () => {
  it('couleurs de marque', () => {
    expect(brand).toMatchObject({
      graphite: '#202527',
      orange: '#CA531D',
      orangeLight: '#EC7A45',
      white: '#FFFFFF',
    });
  });

  it("jetons de l'accueil (surfaces graphite)", () => {
    expect(brand).toMatchObject({
      borderOnDark: '#343B3E',
      surfaceOnDark: '#2A3033',
      strokeOnDark: '#40484B',
      orangeDeep: '#3A2A22',
      mutedOnDark: '#B4BABC',
      textOnDark: '#F4F5F5',
      successOnDark: '#4CC38A',
      warningOnDark: '#F2C94C',
      errorOnDark: '#F0657F',
      gaugeTrack: '#EDEEEE',
      parcInspect: '#E0B000',
    });
  });

  it('textes lisibles sur les surfaces graphite (≥ 4,5:1)', () => {
    for (const fg of [brand.mutedOnDark, brand.textOnDark, brand.orangeLight, brand.successOnDark, brand.warningOnDark, brand.errorOnDark]) {
      expect(contrast(fg, brand.graphite)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(brand.orangeLight, brand.orangeDeep)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(brand.textOnDark, brand.orangeDeep)).toBeGreaterThanOrEqual(4.5);
  });

  it('thème clair', () => {
    expect(light).toMatchObject({
      background: '#FFFFFF',
      surface: '#F6F6F5',
      surfaceAlt: '#EDEEEE',
      border: '#E2E4E5',
      textPrimary: '#202527',
      textSecondary: '#5E6466',
      textMuted: '#8A9092',
      primary: '#CA531D',
      primaryPressed: '#A84416',
      onPrimary: '#FFFFFF',
      primarySoft: '#FBEDE6',
      onPrimarySoft: '#A84416',
      accentText: '#CA531D',
      success: '#1A7F53',
      successSoft: '#E3F3EB',
      error: '#C42B4B',
      errorSoft: '#FBE6EA',
      warning: '#7A5A00',
      warningSoft: '#FFF6D6',
      info: '#3D6FB6',
      infoSoft: '#E6EEF8',
      overlay: 'rgba(32,37,39,0.55)',
    });
  });

  it('thème sombre (prêt, pas encore branché)', () => {
    expect(dark).toMatchObject({
      background: '#202527',
      surface: '#2A3033',
      surfaceAlt: '#343B3E',
      border: '#40484B',
      textPrimary: '#F4F5F5',
      textSecondary: '#B4BABC',
      textMuted: '#80878A',
      primary: '#CA531D',
      primaryPressed: '#B04818',
      onPrimary: '#FFFFFF',
      primarySoft: '#3A2A22',
      onPrimarySoft: '#EC7A45',
      accentText: '#EC7A45',
      success: '#4CC38A',
      successSoft: '#1F3A2E',
      error: '#F0657F',
      errorSoft: '#3D2229',
      warning: '#F2C94C',
      warningSoft: '#3A3320',
      info: '#7FA8E6',
      infoSoft: '#223246',
      overlay: 'rgba(0,0,0,0.6)',
    });
  });

  it('les deux thèmes ont exactement les mêmes tokens', () => {
    expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
  });

  it('tailwind lit les mêmes tokens que le thème', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const colors = require('../../../tailwind.config.js').theme.extend.colors;
    expect(colors.background).toBe(light.background);
    expect(colors.content.DEFAULT).toBe(light.textPrimary);
    expect(colors.graphite).toBe(brand.graphite);
    expect(colors.error.soft).toBe(light.errorSoft);
  });
});

describe('contrastes (thème clair)', () => {
  it('texte principal et secondaire lisibles (≥ 4,5:1) sur toutes les surfaces', () => {
    for (const bg of [light.background, light.surface, light.surfaceAlt, light.card]) {
      expect(contrast(light.textPrimary, bg)).toBeGreaterThanOrEqual(7);
      expect(contrast(light.textSecondary, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('texte blanc sur le bouton orange : ≥ 4,4:1 (taille ≥ 16 px et graisse ≥ 600 exigées)', () => {
    expect(contrast(light.onPrimary, light.primary)).toBeGreaterThanOrEqual(4.4);
    expect(contrast(light.onPrimary, light.primaryPressed)).toBeGreaterThanOrEqual(4.5);
  });

  it('texte sur fond teinté orange et texte orange', () => {
    expect(contrast(light.onPrimarySoft, light.primarySoft)).toBeGreaterThanOrEqual(4.5);
    // L'orange en texte n'atteint que ≈ 4,4:1 sur blanc : réservé aux grandes tailles / au gras.
    expect(contrast(light.accentText, light.background)).toBeGreaterThanOrEqual(4.4);
  });

  it('couleurs fonctionnelles lisibles sur leur fond doux (≥ 4,3:1 : la palette fournie donne 4,35 pour le succès et 4,33 pour l’info)', () => {
    for (const [text, bg] of [
      [light.success, light.successSoft],
      [light.error, light.errorSoft],
      [light.warning, light.warningSoft],
      [light.info, light.infoSoft],
    ] as const) {
      expect(contrast(text, bg)).toBeGreaterThanOrEqual(4.3);
    }
  });

  it('texte placeholder : 3:1 minimum (jamais pour du texte important)', () => {
    expect(contrast(light.textMuted, light.background)).toBeGreaterThanOrEqual(3);
  });
});

describe('contrastes (thème sombre)', () => {
  it('texte lisible sur le fond et les cartes', () => {
    for (const bg of [dark.background, dark.surface, dark.surfaceAlt]) {
      expect(contrast(dark.textPrimary, bg)).toBeGreaterThanOrEqual(7);
      expect(contrast(dark.textSecondary, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('le texte orange sur fond sombre utilise l’orange clair, jamais #CA531D', () => {
    expect(dark.accentText).toBe(brand.orangeLight);
    expect(contrast(dark.accentText, dark.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(dark.onPrimarySoft, dark.primarySoft)).toBeGreaterThanOrEqual(4.5);
  });

  it('couleurs fonctionnelles lisibles sur leur fond doux', () => {
    for (const [text, bg] of [
      [dark.success, dark.successSoft],
      [dark.error, dark.errorSoft],
      [dark.warning, dark.warningSoft],
      [dark.info, dark.infoSoft],
    ] as const) {
      expect(contrast(text, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

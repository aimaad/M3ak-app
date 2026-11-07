import { BRAND } from '../brand';
import { BibipPalette as P } from '../theme';

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

describe('identité BIBIP « Emerald Ivory » : valeurs officielles', () => {
  it('les couleurs imposées par la marque', () => {
    expect(P.primary).toBe('#087F70');
    expect(P.background).toBe('#FAF8F1');
    expect(P.surface).toBe('#FFFFFF');
    expect(P.ink).toBe('#202B29');
  });

  it('tailwind lit la même source de vérité que le thème', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const config = require('../../../tailwind.config.js');
    const colors = config.theme.extend.colors;
    expect(colors.primary.DEFAULT).toBe(BRAND.primary);
    expect(colors.brand.deep).toBe(BRAND.primaryDeep);
    expect(colors.canvas).toBe(BRAND.background);
    expect(colors.ink).toBe(BRAND.ink);
    expect(colors.line.DEFAULT).toBe(BRAND.border);
  });
});

describe('contraste de la palette BIBIP (WCAG AA : 4,5 pour le texte, 3 pour les icônes)', () => {
  it("texte blanc sur l'émeraude signature (boutons) et sur l'émeraude profond (hero)", () => {
    expect(contrast(P.onPrimary, P.primary)).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#FFFFFF', P.primaryDeep)).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#FFFFFF', P.primaryPressed)).toBeGreaterThanOrEqual(4.5);
  });

  it("texte émeraude d'action sur blanc, sur le fond ivoire et sur les teintes claires", () => {
    for (const bg of ['#FFFFFF', P.background]) expect(contrast(P.primary, bg)).toBeGreaterThanOrEqual(4.5);
    // Sur les teintes émeraude claires, on utilise l'émeraude appuyé (plus foncé).
    for (const bg of [P.primaryLight, P.primarySoft]) expect(contrast(P.primaryPressed, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('texte secondaire lisible sur toutes les surfaces', () => {
    for (const bg of ['#FFFFFF', P.background, P.primaryLight, P.primarySoft]) expect(contrast(P.muted, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('texte principal très contrasté', () => {
    expect(contrast(P.ink, P.background)).toBeGreaterThanOrEqual(7);
    expect(contrast(P.primaryDeep, P.primaryLight)).toBeGreaterThanOrEqual(7);
  });

  it('icônes inactives : 3:1 sur blanc', () => {
    expect(contrast(P.subtle, '#FFFFFF')).toBeGreaterThanOrEqual(3);
  });

  it("textes clairs et accents sur l'émeraude profond (hero, carte des revenus)", () => {
    expect(contrast('#BFE6DE', P.primaryDeep)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(P.mint, P.primaryDeep)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(P.lime, P.primaryDeep)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(P.warning, P.primaryDeep)).toBeGreaterThanOrEqual(3);
  });

  it('couleurs fonctionnelles : le texte sur fond clair utilise les variantes foncées (4,5:1)', () => {
    const pairs: [string, string][] = [
      [P.successText, P.successLight],
      [P.infoText, P.infoLight],
      [P.warningText, P.warningLight],
      [P.dangerText, P.dangerLight],
      [P.neutralText, P.neutralLight],
    ];
    for (const [text, bg] of pairs) {
      expect(contrast(text, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(text, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("couleurs fonctionnelles : pastilles et icônes lisibles (3:1) sur blanc, texte sombre sur ambre", () => {
    for (const color of [P.success, P.info, P.danger, P.neutral]) expect(contrast(color, '#FFFFFF')).toBeGreaterThanOrEqual(3);
    expect(contrast(P.night, P.warning)).toBeGreaterThanOrEqual(4.5);
  });

  it("le vert « succès » reste distinct de l'émeraude de la marque", () => {
    expect(P.success).not.toBe(P.primary);
    expect(P.successText).not.toBe(P.primary);
  });
});

import { M3akPalette as P } from '../theme';

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

describe('contraste de la palette M3ak (WCAG AA : 4,5 pour le texte, 3 pour les icônes)', () => {
  it('texte blanc sur le mauve signature (boutons) et sur le mauve profond (hero)', () => {
    expect(contrast(P.onPrimary, P.primary)).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#FFFFFF', P.mauve)).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#FFFFFF', P.mauveDeep)).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#FFFFFF', P.primaryPressed)).toBeGreaterThanOrEqual(4.5);
  });

  it("texte mauve d'action sur blanc, sur le fond ivoire et sur les teintes claires", () => {
    for (const bg of ['#FFFFFF', P.background, P.mauveLight, P.mauveSoft]) expect(contrast(P.mauve, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('texte secondaire lisible sur toutes les surfaces', () => {
    for (const bg of ['#FFFFFF', P.background, P.mauveLight, P.mauveSoft]) expect(contrast(P.muted, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('texte principal très contrasté', () => {
    expect(contrast(P.ink, P.background)).toBeGreaterThanOrEqual(7);
    expect(contrast(P.mauveDeep, P.mauveLight)).toBeGreaterThanOrEqual(7);
  });

  it('icônes inactives : 3:1 sur blanc', () => {
    expect(contrast(P.subtle, '#FFFFFF')).toBeGreaterThanOrEqual(3);
  });

  it('textes clairs et accents sur le mauve profond (hero, carte des revenus)', () => {
    expect(contrast('#CBB8E0', P.mauveDeep)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(P.lavender, P.mauveDeep)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(P.warning, P.mauveDeep)).toBeGreaterThanOrEqual(3);
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

  it('couleurs fonctionnelles : pastilles et icônes lisibles (3:1) sur blanc, texte noir aubergine sur ambre', () => {
    for (const color of [P.success, P.info, P.danger, P.neutral]) expect(contrast(color, '#FFFFFF')).toBeGreaterThanOrEqual(3);
    expect(contrast(P.aubergine, P.warning)).toBeGreaterThanOrEqual(4.5);
  });
});

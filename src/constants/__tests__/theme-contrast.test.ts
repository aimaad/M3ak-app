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

describe('contraste du design system Kriha (WCAG AA : 4,5 pour le texte, 3 pour les icônes)', () => {
  it('texte blanc sur le vert d\'action et sur le vert forêt', () => {
    expect(contrast('#FFFFFF', P.mauve)).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#FFFFFF', P.mauveDeep)).toBeGreaterThanOrEqual(4.5);
  });

  it('texte foncé sur l\'émeraude du bouton principal (le blanc y échoue, d\'où ce jeton)', () => {
    expect(contrast(P.onEmerald, P.emerald)).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#FFFFFF', P.emerald)).toBeLessThan(4.5);
  });

  it('texte vert d\'action sur blanc et sur les teintes claires', () => {
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

  it('textes clairs sur la carte vert forêt (revenus)', () => {
    expect(contrast('#A7F3D0', P.mauveDeep)).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#6EE7B7', P.mauveDeep)).toBeGreaterThanOrEqual(3);
    expect(contrast(P.gold, P.mauveDeep)).toBeGreaterThanOrEqual(3);
  });

  it('statuts : avertissement et succès lisibles sur leur fond clair ; le rouge sert d\'icône (3:1), le texte rouge sur rouge pâle est le rouge foncé', () => {
    expect(contrast(P.warning, P.warningLight)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(P.success, P.successLight)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(P.danger, P.dangerLight)).toBeGreaterThanOrEqual(3);
    expect(contrast('#B91C1C', P.dangerLight)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(P.danger, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
  });
});

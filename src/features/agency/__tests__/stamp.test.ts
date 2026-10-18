import { defaultStampConfig, escapeXml, parseStampConfig, stampSvg, STAMP_INK } from '../stamp';

describe('cachet de l\'agence', () => {
  const config = defaultStampConfig({ nom: 'Atlas Cars', raisonSociale: 'Atlas Cars SARL', ville: 'Casablanca', telephone: '+212 5 22 00 00 00' });

  it('propose un cachet à partir des informations de l\'entreprise', () => {
    expect(config).toMatchObject({ shape: 'round', color: 'blue', title: 'ATLAS CARS', bottom: 'CASABLANCA' });
    expect(config.lines).toEqual(['Atlas Cars SARL', 'Tél : +212 5 22 00 00 00']);
  });

  it('n\'répète pas la raison sociale quand elle est identique au nom', () => {
    expect(defaultStampConfig({ nom: 'Atlas', raisonSociale: 'Atlas' }).lines).toEqual([]);
  });

  it('dessine un vrai cachet : anneaux, texte en arc, lignes et couleur d\'encre', () => {
    const svg = stampSvg(config);
    expect(svg).toContain('<circle');
    expect(svg).toContain('textPath');
    expect(svg).toContain('ATLAS CARS');
    expect(svg).toContain('CASABLANCA');
    expect(svg).toContain(STAMP_INK.blue);
    expect(stampSvg({ ...config, shape: 'rect', color: 'red' })).toContain('<rect');
    expect(stampSvg({ ...config, shape: 'oval', color: 'black' })).toContain('<ellipse');
  });

  it('échappe tout texte : aucune balise ne peut entrer dans le SVG', () => {
    const evil = parseStampConfig({ ...config, title: 'A</text><script>alert(1)</script>', lines: ['<img src=x onerror=1>'] });
    const svg = stampSvg(evil as NonNullable<typeof evil>);
    expect(svg).not.toContain('<script');
    expect(svg).not.toContain('<img');
    expect(escapeXml('a&b"c')).toBe('a&amp;b&quot;c');
  });

  it('refuse une configuration invalide ou vide', () => {
    expect(parseStampConfig(null)).toBeNull();
    expect(parseStampConfig({ ...config, shape: 'triangle' })).toBeNull();
    expect(parseStampConfig({ ...config, color: 'pink' })).toBeNull();
    expect(parseStampConfig({ ...config, title: '   ' })).toBeNull();
    expect(parseStampConfig({ ...config, v: 2 })).toBeNull();
  });

  it('limite la longueur et le nombre de lignes', () => {
    const parsed = parseStampConfig({ ...config, title: 'x'.repeat(100), lines: ['a', 'b', 'c', 'd', 'e'] });
    expect(parsed?.title).toHaveLength(36);
    expect(parsed?.lines).toHaveLength(3);
  });
});

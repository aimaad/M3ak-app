import { defaultStampConfig, escapeXml, parseStampConfig, stampLines, stampSvg, STAMP_INK, wrapText } from '../stamp';

describe('cachet de l\'agence', () => {
  const config = defaultStampConfig({ nom: 'Atlas Cars', adresse: '12 avenue Hassan II', ville: 'Casablanca', telephone: '+212 5 22 00 00 00' });

  it("propose un cachet à partir des informations de l'entreprise", () => {
    expect(config).toMatchObject({ shape: 'round', color: 'blue', title: 'ATLAS CARS', address: '12 avenue Hassan II, Casablanca', tel: '+212 5 22 00 00 00', gsm: '' });
    expect(config).not.toHaveProperty('bottom');
  });

  it("range les lignes dans l'ordre : adresse, téléphone, GSM", () => {
    const full = { ...config, address: '12 avenue Hassan II', tel: '0522000000', gsm: '0661000000' };
    expect(stampLines(full, 30)).toEqual(['12 avenue Hassan II', 'Tél : 0522000000', 'GSM : 0661000000']);
    expect(stampLines({ ...full, tel: '' }, 30)).toEqual(['12 avenue Hassan II', 'GSM : 0661000000']);
  });

  it('passe une adresse longue sur 2 lignes, abrégée si elle déborde encore', () => {
    expect(wrapText('12 avenue Hassan II, quartier Maarif, Casablanca', 28)).toEqual(['12 avenue Hassan II,', 'quartier Maarif, Casablanca']);
    expect(wrapText('Rue courte', 26)).toEqual(['Rue courte']);
    const long = wrapText('Immeuble Al Amal numéro 45 boulevard Mohammed V quartier des Habous centre ville Casablanca', 26);
    expect(long).toHaveLength(2);
    expect(long[1].endsWith('…')).toBe(true);
  });

  it('n\'ajoute pas la ville deux fois dans l\'adresse', () => {
    expect(defaultStampConfig({ nom: 'A', adresse: '5 rue X, Casablanca', ville: 'Casablanca' }).address).toBe('5 rue X, Casablanca');
    expect(defaultStampConfig({ nom: 'A', adresse: null, ville: 'Settat' }).address).toBe('Settat');
  });

  it('dessine un vrai cachet : anneaux, texte en arc, lignes et couleur d\'encre', () => {
    const svg = stampSvg(config);
    expect(svg).toContain('<circle');
    expect(svg).not.toContain('textPath'); // lettres posées une à une : même rendu partout
    expect(svg).toContain('rotate(');
    expect(svg).toContain('>A</text>');
    expect(svg.match(/font-weight="bold"/g)?.length).toBeGreaterThan(10);
    expect(svg).not.toContain('★'); // plus d'étoiles : le nom prend tout le rond
    expect(svg).toContain(STAMP_INK.blue);
    expect(stampSvg({ ...config, shape: 'rect', color: 'red' })).toContain('<rect');
    expect(stampSvg({ ...config, shape: 'oval', color: 'black' })).toContain('<ellipse');
  });

  it('échappe tout texte : aucune balise ne peut entrer dans le SVG', () => {
    const evil = parseStampConfig({ ...config, title: 'A</text><script>alert(1)</script>', address: '<img src=x onerror=1>' });
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

  it('limite la longueur des textes', () => {
    const parsed = parseStampConfig({ ...config, title: 'x'.repeat(100), address: 'y'.repeat(200), tel: '1'.repeat(50) });
    expect(parsed?.title).toHaveLength(36);
    expect(parsed?.address).toHaveLength(80);
    expect(parsed?.tel).toHaveLength(24);
  });

  it("reprend une ancienne configuration à lignes libres comme adresse", () => {
    expect(parseStampConfig({ v: 1, shape: 'round', color: 'blue', title: 'A', lines: ['Rue 1', 'Casa'] })?.address).toBe('Rue 1 Casa');
  });
});

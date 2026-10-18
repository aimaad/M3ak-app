import { buildContractHtml, contractTemplateContext, contractTemplateValues, resolveTemplate } from '../contract-pdf';
import { AGENCY_HEADER_LINES, defaultOptions, templateFromOptions } from '../contract-options';
import { defaultContractTemplate } from '../default-template';
import { sampleContract } from '../sample-contract';
import {
  ensureSignatures,
  fillPlaceholders,
  hasLanguageToggle,
  parseTemplate,
  PLACEHOLDERS,
  readingSections,
} from '../template';
import { estimateSheetHeights, PAGE, PRINT_SIZE, renderTemplateHtml, safeImage } from '../template-render';

const agency = { nom: 'Agence Atlas', ville: 'Rabat', adresse: '1 av. Mohammed V' };

const custom = {
  v: 1,
  direction: 'ltr',
  blocks: [
    { type: 'header', logo: 'left', left: '{{agence_nom}}\n{{agence_adresse}}' },
    { type: 'heading', text: 'CONTRAT DE LOCATION N° {{numero}}', align: 'center', size: 'xl', border: 'box' },
    { type: 'fields', columns: 2, bordered: true, rows: [
      { label: 'Nom du locataire', value: '{{client_nom}}' },
      { label: 'Permis N°', value: '{{numero_permis}}' },
      { label: 'Conducteur', value: '{{conducteur_principal}}', optional: true },
    ] },
    { type: 'paragraph', text: 'Article 1 — Le locataire s’engage à restituer le véhicule.' },
    { type: 'signatures', boxes: [{ role: 'client', label: 'Lu et approuvé' }, { role: 'agency', label: 'Cachet' }] },
  ],
};

describe('validation du modèle (liste blanche stricte)', () => {
  it('accepte un modèle correct', () => {
    expect(parseTemplate(custom)?.blocks).toHaveLength(5);
  });

  it('ignore les blocs inconnus ou dangereux et les propriétés non prévues', () => {
    const t = parseTemplate({
      blocks: [
        { type: 'script', text: 'alert(1)' },
        { type: 'html', html: '<img src=x onerror=alert(1)>' },
        { type: 'paragraph', text: 'ok', onclick: 'x()', style: 'background:url(x)' },
      ],
    });
    expect(t?.blocks).toHaveLength(1);
    expect(JSON.stringify(t)).not.toMatch(/onclick|style|script|onerror/);
  });

  it('refuse un contenu sans bloc exploitable ou mal formé', () => {
    expect(parseTemplate(null)).toBeNull();
    expect(parseTemplate({ blocks: [] })).toBeNull();
    expect(parseTemplate({ blocks: [{ type: 'fields', rows: [{ label: 1, value: 2 }] }] })).toBeNull();
    expect(parseTemplate('texte')).toBeNull();
  });

  it('borne les tailles', () => {
    const many = { blocks: Array.from({ length: 500 }, () => ({ type: 'rule' })) };
    expect(parseTemplate(many)?.blocks.length).toBeLessThanOrEqual(400);
    const long = parseTemplate({ blocks: [{ type: 'paragraph', text: 'a'.repeat(50_000) }] });
    expect((long?.blocks[0] as { text: string }).text.length).toBeLessThanOrEqual(8000);
  });

  it('ajoute une zone de signature si le modèle n\'en a pas', () => {
    const t = ensureSignatures(parseTemplate({ blocks: [{ type: 'paragraph', text: 'x' }] })!);
    expect(t.blocks.some((b) => b.type === 'signatures')).toBe(true);
    expect(ensureSignatures(t)).toBe(t);
  });
});

describe('champs automatiques', () => {
  it('remplit les champs connus et laisse une ligne à remplir pour les inconnus ou vides', () => {
    expect(fillPlaceholders('A {{client_nom}} B {{numero_permis}} C {{client_cin}}', { client_nom: 'Ali', client_cin: '' })).toBe('A Ali B ………………… C …………………');
  });

  it('toutes les valeurs d\'un contrat sont fournies pour les champs déclarés', () => {
    const values = contractTemplateValues(sampleContract(), agency);
    for (const key of PLACEHOLDERS) expect(key in values).toBe(true);
    expect(values.client_nom).toBe('Nom Client Exemple');
    expect(values.prix_total).toMatch(/1.500 MAD/);
  });
});

describe('génération depuis le modèle de l\'agence (sans IA, instantanée)', () => {
  it('remplit le modèle personnalisé avec les données du contrat', () => {
    const html = buildContractHtml(sampleContract(), agency, {}, custom);
    expect(html).toContain('CONTRAT DE LOCATION N° CTR-EXEMPLE-0001');
    expect(html).toContain('Nom Client Exemple');
    expect(html).toContain('Agence Atlas');
    expect(html).toContain('Permis N°');
    expect(html).toContain('…………………'); // champ sans équivalent : ligne à remplir à la main
    expect(html).toContain('Article 1 — Le locataire');
    expect(html).not.toContain('Conditions générales'); // le modèle par défaut n'est pas mélangé
  });

  it('masque une rubrique facultative vide', () => {
    expect(buildContractHtml(sampleContract(), agency, {}, custom)).not.toContain('>Conducteur<');
  });

  it('échappe toute donnée venant de la base', () => {
    const html = buildContractHtml({ ...sampleContract(), customerNom: '<img src=x onerror=alert(1)>' }, agency, {}, custom);
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img');
  });

  it('un modèle invalide retombe sur le modèle standard', () => {
    expect(buildContractHtml(sampleContract(), agency, {}, { n: 'importe quoi' })).toContain('Conditions générales');
  });

  it('un contrat signé garde SON modèle figé, même si l\'agence change le sien', () => {
    const snapshot = { blocks: [{ type: 'paragraph', text: 'VERSION FIGEE' }] };
    const html = buildContractHtml({ ...sampleContract(), termsSnapshot: snapshot }, agency, {}, custom);
    expect(html).toContain('VERSION FIGEE');
    expect(html).not.toContain('CONTRAT DE LOCATION N°');
  });

  it('place signatures et cachet dans les zones du modèle', () => {
    const sig = { v: 1 as const, width: 300, height: 150, paths: ['M 1 1 L 2 2 L 3 3 L 4 4 L 5 5 L 6 6 L 7 7 L 8 8 L 9 9 L 10 10 L 11 11 L 12 12'] };
    const png = 'data:image/png;base64,iVBORw0KGgo=';
    const html = buildContractHtml(sampleContract(), agency, { client: sig, agency: sig, stampDataUri: png }, custom);
    expect(html.match(/class="sig"/g)).toHaveLength(2);
    expect(html).toContain('class="stamp"');
    expect(html).toContain('Lu et approuvé');
  });

  it('n\'accepte comme logo ou cachet que des images png/jpeg encodées', () => {
    expect(safeImage('data:image/png;base64,AAAA')).not.toBeNull();
    expect(safeImage('data:image/svg+xml;base64,AAAA')).toBeNull();
    expect(safeImage('https://x.test/a.png')).toBeNull();
    expect(safeImage('data:image/png;base64,AA" onerror="x')).toBeNull();
    const t = parseTemplate(custom)!;
    const ctx = contractTemplateContext(sampleContract());
    const html = renderTemplateHtml(t, { values: {}, context: ctx, clientName: 'x', agencyName: 'y', logoDataUri: 'javascript:alert(1)' });
    expect(html).not.toContain('javascript:');
  });
});

describe('lecture avant signature', () => {
  const ctx = contractTemplateContext(sampleContract());
  const values = contractTemplateValues(sampleContract(), agency);

  it('affiche le texte du modèle de l\'agence, champs remplis', () => {
    const sections = readingSections(parseTemplate(custom)!, values, ctx);
    const all = sections.map((s) => `${s.title ?? ''} ${s.text}`).join('\n');
    expect(all).toContain('CONTRAT DE LOCATION N° CTR-EXEMPLE-0001');
    expect(all).toContain('Article 1');
    expect(hasLanguageToggle(sections)).toBe(false);
  });

  it('le modèle standard bilingue propose le choix français / arabe', () => {
    const t = defaultContractTemplate({ caution: '3 000 MAD', city: 'Rabat', agencyLines: ['Agence Atlas'] });
    const sections = readingSections(t, values, ctx);
    expect(hasLanguageToggle(sections)).toBe(true);
    expect(sections.filter((s) => s.lang === 'ar').every((s) => s.rtl)).toBe(true);
  });
});

describe('modèle M3ak standard : carnet de location', () => {
  const contract = {
    ...sampleContract(),
    snapshotValues: {
      client_prenom: 'Sara',
      client_nom_famille: 'Alaoui',
      client_naissance: '26/09/2001',
      client_nationalite: 'Maroc',
      client_adresse: '5 rue Atlas, Settat',
      client_permis: '19/226595',
      client_permis_delivre_le: '10/03/2020',
      client_permis_delivre_a: 'Settat',
      conducteur2_nom: 'Benali',
      conducteur2_prenom: 'Karim',
    },
  };
  const html = buildContractHtml(contract, { nom: 'Atlas Cars', ville: 'Casablanca', telephone: '+212600000000' }, {}, undefined, {
    payments: [{ montant: 500, methode: 'especes', statut: 'paye' }, { montant: 300, methode: 'carte', statut: 'en_attente' }],
    kmDepart: 42000,
    carburantDepart: 75,
  });

  it('reprend les cadres d\'un carnet de location', () => {
    for (const title of ['Conducteur 1', 'Conducteur 2', 'Véhicule et période', 'Paiement', 'Kilométrage', 'Franchise sinistre', 'État du véhicule (Départ)', 'Niveau de carburant']) {
      expect(html).toContain(title);
    }
    expect(html).not.toContain('État du véhicule (Retour)');
    expect(html).toContain('R: rayures');
    expect(html).not.toContain('Patente'); // affichée seulement si l'agence l'a renseignée
  });

  it('remplit le conducteur 1 avec la fiche client figée', () => {
    for (const value of ['Alaoui', 'Sara', '26/09/2001', '5 rue Atlas, Settat', '19/226595', '10/03/2020', 'Benali', 'Karim']) {
      expect(html).toContain(value);
    }
  });

  it('calcule jours, prix par jour, avance et reste depuis les paiements encaissés uniquement', () => {
    expect(html).toMatch(/Nombre de jours[\s\S]*?>3</);
    expect(html.replace(/\s/g, ' ')).toMatch(/500 MAD/); // avance : seul le paiement « paye » compte
    expect(html.replace(/\s/g, ' ')).toMatch(/1.000 MAD/); // reste = 1500 - 500
    expect(html).toContain('Espèces');
    expect(html).toContain('42000');
    expect(html).toContain('75 %');
  });

  it('met les cadres « half » côte à côte et le verso sur une nouvelle page', () => {
    expect(html).toContain('class="pair"');
    const sheets = html.match(/<section class="sheet/g) ?? [];
    expect(sheets).toHaveLength(2); // recto + verso : exactement deux feuilles
    expect(html.indexOf('class="sheet last"')).toBeLessThan(html.indexOf('Article 1'));
    expect(html.indexOf('Franchise sinistre')).toBeLessThan(html.indexOf('class="sheet last"')); // tout le formulaire est au recto
  });
});

describe('cadres personnalisés (ajout, suppression, champs)', () => {
  const t = parseTemplate({
    blocks: [
      { type: 'box', title: 'Mon cadre', width: 'half', rows: [{ label: 'Champ ajouté', value: '' }, { label: 'Client', value: '{{client_nom}}' }] },
      { type: 'box', width: 'half', title: 'Texte', rows: [], text: 'Clause libre <b>x</b>' },
      { type: 'fuelGauge', width: 'half' },
      { type: 'vehicleDiagram', title: 'État', legend: 'A: x' },
      { type: 'box', rows: [] },
    ],
  })!;

  it('valide les nouveaux blocs et ignore un cadre vide', () => {
    expect(t.blocks).toHaveLength(4);
  });

  it('affiche un champ ajouté par le propriétaire et échappe le texte libre', () => {
    const html = buildContractHtml(sampleContract(), 'Agence', {}, t);
    expect(html).toContain('Champ ajouté');
    expect(html).toContain('Clause libre &lt;b&gt;x&lt;/b&gt;');
    expect(html).toContain('A: x');
  });
});

describe('contrat vierge', () => {
  it('ne contient aucune donnée d\'exemple : informations de l\'agence seulement, le reste en lignes à remplir', () => {
    const t = defaultContractTemplate({ caution: '{{caution}}', city: '{{agence_ville}}', agencyLines: ['{{agence_nom}}'] });
    const html = renderTemplateHtml(t, {
      values: { agence_nom: 'Atlas Cars' },
      context: { hasDrivers: true, hasConditions: true, hasDeparture: true },
      clientName: '',
      agencyName: 'Atlas Cars',
    });
    expect(html).toContain('Atlas Cars');
    expect(html).toContain('…………………');
    for (const fake of ['Nom Client Exemple', 'CTR-EXEMPLE', 'Dacia', 'Logan', '1500', '1 500']) expect(html).not.toContain(fake);
  });
});

describe('mise en page : recto et verso sur deux feuilles A4', () => {
  const agency = { nom: 'Location Imad', adresse: '12 rue Hassan II, Casablanca', ville: 'Casablanca', telephone: '+212 6 60 44 10 70' };

  it('le formulaire entier est sur la première feuille et les conditions sur la seconde', () => {
    const html = buildContractHtml(sampleContract(), agency);
    const [front, back] = html.split('class="sheet last"');
    for (const word of ['Conducteur 1', 'Paiement', 'Kilométrage', 'Franchise sinistre', 'Signature du locataire']) expect(front).toContain(word);
    expect(front).not.toContain('Article 1');
    expect(back).toContain('Article 1');
    expect(back).toContain('Article 14');
    expect(back).not.toContain('Conducteur 1');
  });

  it('chaque feuille est ajustée pour remplir une page, sans devenir illisible', () => {
    const html = buildContractHtml(sampleContract(), agency);
    const zooms = [...html.matchAll(/zoom:([0-9.]+)/g)].map((m) => Number(m[1]));
    expect(zooms.length).toBeGreaterThan(0);
    for (const zoom of zooms) {
      expect(zoom).toBeGreaterThanOrEqual(0.7);
      expect(zoom).toBeLessThanOrEqual(1.8);
    }
  });

  it('les hauteurs estimées restent proches de celles mesurées sur un rendu réel (recto ≈ 896 px, verso ≈ 546 px)', () => {
    const c = sampleContract();
    const template = resolveTemplate(c, agency);
    const [front, back] = estimateSheetHeights(template, { values: contractTemplateValues(c, agency), context: contractTemplateContext(c), clientName: 'x', agencyName: 'y' });
    expect(front).toBeGreaterThan(830);
    expect(front).toBeLessThan(990);
    expect(back).toBeGreaterThan(500);
    expect(back).toBeLessThan(620);
  });

  it('un verso très chargé est moins agrandi plutôt que coupé ou reporté', () => {
    const o = defaultOptions();
    const many = { ...o, conditions: [...o.conditions, ...o.conditions] };
    const html = buildContractHtml(sampleContract(), agency, {}, templateFromOptions(many, ['{{agence_nom}}']));
    expect(html.match(/<section class="sheet/g)).toHaveLength(2);
    const zooms = [...html.matchAll(/zoom:([0-9.]+)/g)].map((m) => Number(m[1]));
    expect(Math.min(...zooms)).toBeLessThan(1.2);
  });
});

describe('en-tête sans informations manquantes', () => {
  it('une adresse ou un téléphone non renseignés ne laissent pas de ligne en pointillés', () => {
    const t = templateFromOptions(defaultOptions(), AGENCY_HEADER_LINES);
    const html = buildContractHtml(sampleContract(), { nom: 'Location imad' }, {}, t);
    const header = html.slice(html.indexOf('class="header"'), html.indexOf('CONTRAT DE LOCATION'));
    expect(header).toContain('Location imad');
    expect(header).not.toContain('…');
    expect(header).not.toContain('Tél');
  });

  it('les informations renseignées s\'affichent dans l\'en-tête', () => {
    const t = templateFromOptions(defaultOptions(), AGENCY_HEADER_LINES);
    const html = buildContractHtml(sampleContract(), { nom: 'Location imad', adresse: '12 rue Hassan II', ville: 'Casablanca', telephone: '+212600000000' }, {}, t);
    const header = html.slice(html.indexOf('class="header"'), html.indexOf('CONTRAT DE LOCATION'));
    expect(header).toContain('12 rue Hassan II, Casablanca');
    expect(header).toContain('Tél : +212600000000');
    // ville seule : affichée sans virgule parasite
    const cityOnly = buildContractHtml(sampleContract(), { nom: 'Location imad', ville: 'Rabat' }, {}, t);
    expect(cityOnly.slice(cityOnly.indexOf('class="header"'), cityOnly.indexOf('CONTRAT DE LOCATION'))).toContain('Rabat');
  });

  it('la feuille est dimensionnée comme un A4 en pixels CSS (794 × 1123) et imprimée en 595 × 842 points', () => {
    expect(PAGE.width).toBe(794);
    expect(PAGE.height).toBe(1123);
    expect(PRINT_SIZE).toEqual({ width: 595, height: 842 });
    expect(buildContractHtml(sampleContract(), 'Agence')).toContain('size: 794px 1123px');
  });
});

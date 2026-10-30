import { buildContractHtml } from '../contract-pdf';
import { CLIENT_FIELD_KEYS, defaultOptions, legalLine, parseOptions, SECTION_KEYS, templateFromOptions } from '../contract-options';
import { sampleContract } from '../sample-contract';
import { parseTemplate } from '../template';

const LINES = ['{{agence_nom}}'];
const render = (options = defaultOptions()) => buildContractHtml(sampleContract(), { nom: 'Atlas Cars' }, {}, templateFromOptions(options, LINES));

describe('réglages simples du contrat', () => {
  it('le modèle fabriqué avec les réglages par défaut est valide et complet', () => {
    expect(parseTemplate(templateFromOptions(defaultOptions(), LINES))).not.toBeNull();
    const html = render();
    for (const word of ['Conducteur 1', 'Conducteur 2', 'Paiement', 'Kilométrage', 'Niveau de carburant', 'Franchise sinistre', 'État du véhicule (Départ)', 'Article 1', 'Article 12']) {
      expect(html).toContain(word);
    }
  });

  it('un interrupteur coupé retire la rubrique du contrat', () => {
    const o = defaultOptions();
    const html = render({ ...o, sections: { ...o.sections, paiement: false, conducteur2: false, kilometrage: false, carburant: false, etatVehicule: false, franchise: false, conditions: false } });
    for (const word of ['Paiement', 'Conducteur 2', 'Kilométrage', 'Niveau de carburant', 'État du véhicule (Départ)', 'Franchise sinistre', 'Article 1']) {
      expect(html).not.toContain(word);
    }
    expect(html).toContain('Conducteur 1');
    expect(html.match(/<section class="sheet/g)).toHaveLength(1); // sans conditions : une seule feuille
  });

  it('chaque information du client peut être retirée', () => {
    const labels: Record<string, string> = { naissance: 'Date de naissance', nationalite: 'Nationalité', adresseEtranger: "Adresse à l&#39;étranger", hotel: 'Hôtel', cin: 'C.I.N', passeport: 'Passeport' };
    for (const key of CLIENT_FIELD_KEYS) {
      const o = defaultOptions();
      const count = (html: string) => html.split(labels[key]).length - 1;
      const withField = count(render(o));
      expect(withField).toBeGreaterThan(0);
      expect(count(render({ ...o, clientFields: { ...o.clientFields, [key]: false } }))).toBe(withField - 1);
    }
  });

  it('une information ajoutée apparaît comme ligne à remplir à la main', () => {
    const html = render({ ...defaultOptions(), extraFields: ['Numéro de dossier'] });
    expect(html).toContain('Numéro de dossier');
  });

  it('les mentions légales renseignées s\'affichent, les autres non', () => {
    expect(legalLine({ patente: '123', rc: '', if: '789', cnss: '', extra: [] })).toBe('Patente : 123  -  I.F : 789');
    expect(legalLine({ patente: '', rc: '', if: '', cnss: '', extra: [] })).toBe('');
    const html = render({ ...defaultOptions(), legal: { patente: '36191611', rc: '336151', if: '15285760', cnss: '4617257', extra: [] } });
    for (const v of ['Patente : 36191611', 'R.C : 336151', 'I.F : 15285760', 'C.N.S.S : 4617257']) expect(html).toContain(v);
    expect(render()).not.toContain('Patente');
  });

  it('une condition modifiée, supprimée ou ajoutée est prise en compte', () => {
    const o = defaultOptions();
    const edited = { ...o, conditions: [{ ...o.conditions[0], textFr: 'Texte à moi pour la condition' }, ...o.conditions.slice(2), { titleFr: 'Ma clause', textFr: 'Interdit de fumer', titleAr: '', textAr: '' }] };
    const html = render(edited);
    expect(html).toContain('Texte à moi pour la condition');
    expect(html).toContain('Ma clause');
    expect(html).toContain('Interdit de fumer');
    expect(html).not.toContain('Durée et restitution');
    expect(html).toContain(`Article ${edited.conditions.length}`);
  });

  it('le texte de franchise est modifiable', () => {
    expect(render({ ...defaultOptions(), franchiseText: 'Franchise de 5 000 MAD.' })).toContain('Franchise de 5 000 MAD.');
  });

  it('échappe tout ce que le propriétaire écrit', () => {
    const html = render({ ...defaultOptions(), extraFields: ['<img src=x onerror=alert(1)>'], legal: { patente: '<b>1</b>', rc: '', if: '', cnss: '', extra: [] } });
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<b>1</b>');
  });

  it('relit des réglages enregistrés et corrige ce qui est invalide', () => {
    const o = defaultOptions();
    expect(parseOptions(o)).toEqual(o);
    expect(parseOptions(null)).toBeNull();
    expect(parseOptions({ v: 2 })).toBeNull();
    const parsed = parseOptions({ v: 1, clientFields: { naissance: 'oui', cin: false }, sections: { paiement: false, inconnu: true }, extraFields: ['a', 1, '', 'b'], conditions: [{ titleFr: 'x', textFr: 'y' }, { nope: true }] })!;
    expect(parsed.clientFields.naissance).toBe(true); // valeur invalide : défaut
    expect(parsed.clientFields.cin).toBe(false);
    expect(parsed.sections.paiement).toBe(false);
    expect(parsed.extraFields).toEqual(['a', 'b']);
    expect(parsed.conditions).toHaveLength(1);
    expect(Object.keys(parsed.sections).sort()).toEqual([...SECTION_KEYS].sort());
  });

  it('borne le nombre d\'informations en plus', () => {
    const parsed = parseOptions({ v: 1, extraFields: Array.from({ length: 50 }, (_, i) => `Champ ${i}`) })!;
    expect(parsed.extraFields.length).toBeLessThanOrEqual(12);
  });

  it('le propriétaire ajoute ses propres numéros (ex. ICE) comme la patente', () => {
    const o = defaultOptions();
    const html = render({ ...o, legal: { ...o.legal, patente: '123', extra: [{ label: 'ICE', value: '000123456789012' }, { label: 'Autorisation N°', value: '77/2020' }] } });
    expect(html).toContain('Patente : 123');
    expect(html).toContain('ICE : 000123456789012');
    expect(html).toContain('Autorisation N° : 77/2020');
  });

  it('relit les numéros ajoutés, ignore les incomplets et les borne', () => {
    const parsed = parseOptions({ v: 1, legal: { extra: [{ label: 'ICE', value: '1' }, { label: 'Sans valeur', value: '' }, { value: 'x' }, ...Array.from({ length: 20 }, (_, i) => ({ label: `N${i}`, value: `${i}` }))] } })!;
    expect(parsed.legal.extra[0]).toEqual({ label: 'ICE', value: '1' });
    expect(parsed.legal.extra.length).toBeLessThanOrEqual(8);
    expect(parsed.legal.extra.every((item) => item.label && item.value)).toBe(true);
  });

  it('n\'affiche plus l\'e-mail de l\'agence sur le contrat', () => {
    const html = buildContractHtml(sampleContract(), { nom: 'Atlas Cars', email: 'contact@atlas.ma', telephone: '+212600000000' }, {}, templateFromOptions(defaultOptions(), LINES));
    expect(html).toContain('+212600000000');
    expect(html).not.toContain('contact@atlas.ma');
    const standard = buildContractHtml(sampleContract(), { nom: 'Atlas Cars', email: 'contact@atlas.ma' });
    expect(standard).not.toContain('contact@atlas.ma');
  });

  it('le conducteur 2 a un nom ET un prénom, et il n\'y a plus d\'état du véhicule au retour', () => {
    const html = buildContractHtml({ ...sampleContract(), snapshotValues: { conducteur2_nom: 'Benali', conducteur2_prenom: 'Karim' } }, { nom: 'Atlas Cars' }, {}, templateFromOptions(defaultOptions(), LINES));
    const box = html.slice(html.indexOf('Conducteur 2'), html.indexOf('Paiement'));
    expect(box).toContain('Nom');
    expect(box).toContain('Prénom');
    expect(box).toContain('Benali');
    expect(box).toContain('Karim');
    expect(html).not.toContain('(Retour)');
  });

  it('le logo de l\'agence apparaît en haut du contrat (carnet standard et réglages de l\'agence)', () => {
    const png = 'data:image/png;base64,iVBORw0KGgo=';
    const standard = buildContractHtml(sampleContract(), { nom: 'Atlas Cars' }, { logoDataUri: png });
    expect(standard).toContain('class="logo"');
    expect(standard).toContain(png);
    expect(standard.indexOf('class="logo"')).toBeLessThan(standard.indexOf('CONTRAT DE LOCATION'));

    const custom = buildContractHtml(sampleContract(), { nom: 'Atlas Cars' }, { logoDataUri: png }, templateFromOptions(defaultOptions(), LINES));
    expect(custom).toContain('class="logo"');
    expect(buildContractHtml(sampleContract(), { nom: 'Atlas Cars' })).not.toContain('class="logo"');
  });
});

import { buildContractHtml } from '../contract-pdf';
import { sampleContract } from '../sample-contract';
import { parseTemplate } from '../template';
import { isMostlyArabic, templateFromTranscription } from '../template-from-text';

const TEXT = `> {{agence_nom}}
> {{agence_adresse}} - Tél {{agence_telephone}}

# CONTRAT DE LOCATION N° {{numero}}

## ENTRE LES SOUSSIGNÉS
Nom du locataire : {{client_nom}}
C.I.N : {{client_cin}}
Permis N° : ……………………

Le véhicule : {{marque}} {{modele}}, immatriculé {{immatriculation}}.

## Article 1 : Objet
Le loueur met à disposition du locataire le véhicule désigné ci-dessus.
Le locataire s'engage à le restituer en bon état.

## Article 2 : Obligations
- Respecter le code de la route
- Ne pas sous-louer le véhicule
1. Informer l'agence en cas d'accident

---

## الشروط العامة
يلتزم المكتري بإرجاع السيارة في الحالة التي تسلمها بها.

[SIGNATURES: Le locataire | Pour l'agence]
`;

describe('mise en forme locale de la transcription', () => {
  const template = templateFromTranscription(TEXT)!;

  it('produit un modèle valide', () => {
    expect(template).not.toBeNull();
    expect(parseTemplate(template)).not.toBeNull();
  });

  it('conserve TOUT le texte du contrat', () => {
    const html = buildContractHtml(sampleContract(), { nom: 'Agence Atlas' }, {}, template);
    for (const phrase of [
      'CONTRAT DE LOCATION N° CTR-EXEMPLE-0001',
      'ENTRE LES SOUSSIGNÉS',
      'Article 1 : Objet',
      'Le loueur met à disposition',
      'Le locataire s&#39;engage à le restituer en bon état.',
      'Respecter le code de la route',
      'Ne pas sous-louer le véhicule',
      'Informer l&#39;agence en cas d&#39;accident',
      'الشروط العامة',
      'يلتزم المكتري بإرجاع السيارة',
      'Permis N°',
      'Nom Client Exemple',
      'Agence Atlas',
    ]) {
      expect(html).toContain(phrase);
    }
  });

  it('reconnaît titres, en-tête, tableau de champs, listes, séparateur et signatures', () => {
    const types = template.blocks.map((b) => b.type);
    expect(types).toContain('header');
    expect(types).toContain('heading');
    expect(types).toContain('fields');
    expect(types).toContain('list');
    expect(types).toContain('rule');
    expect(types).toContain('signatures');
  });

  it('range les lignes « Libellé : champ » dans un tableau, et pas les phrases', () => {
    const fields = template.blocks.find((b) => b.type === 'fields');
    expect(fields && fields.type === 'fields' ? fields.rows.map((r) => r.label) : []).toEqual(['Nom du locataire', 'C.I.N', 'Permis N°']);
    const article = template.blocks.find((b) => b.type === 'heading' && b.text.startsWith('Article 1'));
    expect(article).toBeDefined();
  });

  it('met le texte arabe de droite à gauche', () => {
    expect(isMostlyArabic('يلتزم المكتري')).toBe(true);
    expect(isMostlyArabic('Le locataire')).toBe(false);
    const arabic = template.blocks.find((b) => b.type === 'paragraph' && b.text.includes('يلتزم'));
    expect(arabic && 'rtl' in arabic ? arabic.rtl : false).toBe(true);
  });

  it('associe les zones de signature : locataire = client, agence = agence', () => {
    const sig = template.blocks.find((b) => b.type === 'signatures');
    expect(sig && sig.type === 'signatures' ? sig.boxes.map((b) => b.role) : []).toEqual(['client', 'agency']);
  });

  it('ajoute une zone de signature si le contrat n\'en indique pas', () => {
    const t = templateFromTranscription('# Contrat\nTexte simple.')!;
    expect(t.blocks.some((b) => b.type === 'signatures')).toBe(true);
  });

  it('tolère les balises de bloc de code et un texte vide', () => {
    expect(templateFromTranscription('```\n# Titre\nTexte\n```')?.blocks[0]).toMatchObject({ type: 'heading', text: 'Titre' });
    expect(templateFromTranscription('   \n  ')).toBeNull();
  });

  it('garde un long contrat entier (150 articles)', () => {
    const long = Array.from({ length: 150 }, (_, i) => `## Article ${i + 1}\nTexte de l'article ${i + 1}.`).join('\n\n');
    const t = templateFromTranscription(long)!;
    expect(t.blocks.filter((b) => b.type === 'heading')).toHaveLength(150);
  });
});

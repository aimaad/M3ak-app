import { CONTRACT_ACCEPTANCE, contractArticles, type TermsContext } from './contract-terms';
import type { Block, ContractTemplate } from './template';

/**
 * Modèle M3ak standard (français + arabe), utilisé tant que l'agence n'a pas envoyé son propre contrat.
 * `agencyLines` : lignes d'en-tête déjà filtrées (une adresse absente n'affiche pas de ligne vide).
 */
export function defaultContractTemplate(ctx: TermsContext & { agencyLines: string[] }): ContractTemplate {
  const articles = contractArticles(ctx);
  const h = (fr: string, ar: string): Block => ({ type: 'heading', text: `${fr} · ${ar}`, size: 'md', bold: true, border: 'bottom' });

  const blocks: Block[] = [
    { type: 'header', logo: 'left', left: ctx.agencyLines.join('\n') },
    { type: 'heading', text: 'Contrat de location de véhicule · عقد كراء سيارة', size: 'xl', bold: true, border: 'none' },
    { type: 'paragraph', text: 'N° {{numero}}', color: 'muted' },

    h('Le locataire', 'المكتري'),
    {
      type: 'fields',
      rows: [
        { label: 'Client · الزبون', value: '{{client_nom}}' },
        { label: 'CIN / Passeport · البطاقة / الجواز', value: '{{client_cin}}', optional: true },
        { label: 'Téléphone · الهاتف', value: '{{client_telephone}}', optional: true },
        { label: 'Conducteur principal · السائق الرئيسي', value: '{{conducteur_principal}}', optional: true },
        { label: 'Conducteurs supplémentaires · سائقون إضافيون', value: '{{autres_conducteurs}}', optional: true },
      ],
    },

    h('Le véhicule', 'السيارة'),
    {
      type: 'fields',
      rows: [
        { label: 'Marque / modèle · العلامة / الطراز', value: '{{marque}} {{modele}}' },
        { label: 'Immatriculation · رقم التسجيل', value: '{{immatriculation}}' },
      ],
    },

    h('Période et tarif', 'المدة والثمن'),
    {
      type: 'fields',
      rows: [
        { label: 'Départ prévu · الانطلاق', value: '{{date_debut}}' },
        { label: 'Retour prévu · الإرجاع', value: '{{date_fin}}' },
        { label: 'Prix total · الثمن الإجمالي', value: '{{prix_total}}' },
        { label: 'Caution · الضمانة', value: '{{caution}}' },
      ],
    },

    { ...h('État des lieux au départ', 'معاينة الانطلاق'), showIf: 'hasDeparture' },
    {
      type: 'fields',
      showIf: 'hasDeparture',
      rows: [
        { label: 'État général · الحالة العامة', value: '{{etat_depart}}' },
        { label: 'Accessoires remis · الملحقات المسلمة', value: '{{accessoires_depart}}' },
        { label: 'Observations · ملاحظات', value: '{{observations_depart}}', optional: true },
      ],
    },

    { ...h('Conditions particulières', 'شروط خاصة'), showIf: 'hasConditions' },
    { type: 'paragraph', text: '{{conditions_particulieres}}', showIf: 'hasConditions' },

    h('Conditions générales', 'الشروط العامة'),
    ...articles.map<Block>((article, index) => ({
      type: 'columns',
      cells: [
        { title: `Article ${index + 1} — ${article.fr.title}`, text: article.fr.body, lang: 'fr' },
        { title: `المادة ${index + 1} — ${article.ar.title}`, text: article.ar.body, rtl: true, align: 'right', lang: 'ar' },
      ],
    })),

    { type: 'paragraph', text: CONTRACT_ACCEPTANCE.fr, size: 'sm' },
    { type: 'paragraph', text: CONTRACT_ACCEPTANCE.ar, size: 'sm', rtl: true, align: 'right' },
    {
      type: 'signatures',
      boxes: [
        { role: 'client', label: 'Le locataire · المكتري' },
        { role: 'agency', label: "Pour l'agence · عن الوكالة" },
      ],
    },
    {
      type: 'paragraph',
      size: 'xs',
      color: 'muted',
      text: "Document généré par M3ak. Les conditions générales sont un modèle standard : l'agence doit s'assurer de leur conformité à la réglementation applicable avant tout usage commercial.",
    },
  ];

  return { v: 1, direction: 'ltr', blocks };
}

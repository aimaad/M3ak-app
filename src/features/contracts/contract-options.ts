import { CONTRACT_ACCEPTANCE, contractArticles, type TermsContext } from './contract-terms';
import type { Block, ContractTemplate, FieldRow } from './template';

/**
 * Réglages simples d'un contrat d'agence : le propriétaire choisit ce qui apparaît (interrupteurs), complète ses
 * mentions légales, ajoute des informations à remplir à la main et corrige ses conditions. Le modèle de contrat
 * (cadres, champs) est ensuite FABRIQUÉ à partir de ces réglages : le propriétaire n'a jamais à le construire.
 */
export type ClientFieldKey = 'naissance' | 'nationalite' | 'adresseEtranger' | 'hotel' | 'passeport' | 'cin';
export type SectionKey = 'conducteur2' | 'paiement' | 'kilometrage' | 'carburant' | 'etatVehicule' | 'franchise' | 'conditions';

export const CLIENT_FIELD_KEYS: ClientFieldKey[] = ['naissance', 'nationalite', 'adresseEtranger', 'hotel', 'passeport', 'cin'];
export const SECTION_KEYS: SectionKey[] = ['conducteur2', 'paiement', 'kilometrage', 'carburant', 'etatVehicule', 'franchise', 'conditions'];

export type LegalInfo = { patente: string; rc: string; if: string; cnss: string };
export type Condition = { titleFr: string; textFr: string; titleAr: string; textAr: string };

export type ContractOptions = {
  v: 1;
  legal: LegalInfo;
  clientFields: Record<ClientFieldKey, boolean>;
  sections: Record<SectionKey, boolean>;
  /** Informations en plus, à remplir à la main (ex. « Numéro de dossier »). */
  extraFields: string[];
  franchiseText: string;
  conditions: Condition[];
};

export const LIMITS_OPTIONS = { extraFields: 12, conditions: 40, label: 80, text: 4000, legal: 40 } as const;

export const DEFAULT_FRANCHISE_TEXT =
  "Le locataire signataire du présent contrat supportera les frais de réparation et de remise en état du véhicule si le montant des réparations n'excède pas dix pour cent (10 %) de la valeur du véhicule neuf. " +
  "Dans le cas où la réparation des dégâts occasionnés suite à un sinistre dépasse cette limite, la franchise sera supportée par le locataire à hauteur de 10 % de la valeur du véhicule. " +
  "Le client pourra dégager sa participation aux frais moyennant un complément d'assurance ; en cas d'accident, ce complément n'inclut pas le rapatriement du véhicule ni les frais d'immobilisation. " +
  "Le locataire est entièrement et indéfiniment responsable envers les autorités (Sûreté nationale, gendarmerie, douane…) ainsi qu'envers la justice dans le cas où le véhicule serait utilisé pour des produits illicites. " +
  "J'atteste avoir lu et approuvé les clauses de ce contrat, y compris celles du verso.";

/** Réglages de départ : tout est affiché, avec les 14 conditions M3ak. `ctx` fige caution et ville (sinon champs automatiques). */
export function defaultOptions(ctx: TermsContext = { caution: '{{caution}}', city: '{{agence_ville}}' }): ContractOptions {
  return {
    v: 1,
    legal: { patente: '', rc: '', if: '', cnss: '' },
    clientFields: { naissance: true, nationalite: true, adresseEtranger: true, hotel: true, passeport: true, cin: true },
    sections: { conducteur2: true, paiement: true, kilometrage: true, carburant: true, etatVehicule: true, franchise: true, conditions: true },
    extraFields: [],
    franchiseText: DEFAULT_FRANCHISE_TEXT,
    conditions: contractArticles(ctx).map((article) => ({ titleFr: article.fr.title, textFr: article.fr.body, titleAr: article.ar.title, textAr: article.ar.body })),
  };
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const str = (value: unknown, max: number): string | null => (typeof value === 'string' ? value.slice(0, max) : null);

/** Relit des réglages enregistrés ; tout ce qui manque ou est invalide reprend la valeur par défaut. */
export function parseOptions(raw: unknown): ContractOptions | null {
  if (!isObject(raw) || raw.v !== 1) return null;
  const base = defaultOptions();

  const legalRaw = isObject(raw.legal) ? raw.legal : {};
  const legal = { ...base.legal };
  for (const key of ['patente', 'rc', 'if', 'cnss'] as const) legal[key] = str(legalRaw[key], LIMITS_OPTIONS.legal) ?? '';

  const clientFields = { ...base.clientFields };
  const clientRaw = isObject(raw.clientFields) ? raw.clientFields : {};
  for (const key of CLIENT_FIELD_KEYS) if (typeof clientRaw[key] === 'boolean') clientFields[key] = clientRaw[key] as boolean;

  const sections = { ...base.sections };
  const sectionsRaw = isObject(raw.sections) ? raw.sections : {};
  for (const key of SECTION_KEYS) if (typeof sectionsRaw[key] === 'boolean') sections[key] = sectionsRaw[key] as boolean;

  const extraFields = (Array.isArray(raw.extraFields) ? raw.extraFields : [])
    .map((item) => str(item, LIMITS_OPTIONS.label)?.trim() ?? '')
    .filter(Boolean)
    .slice(0, LIMITS_OPTIONS.extraFields);

  const conditions: Condition[] = [];
  if (Array.isArray(raw.conditions)) {
    for (const item of raw.conditions.slice(0, LIMITS_OPTIONS.conditions)) {
      if (!isObject(item)) continue;
      const titleFr = str(item.titleFr, LIMITS_OPTIONS.label) ?? '';
      const textFr = str(item.textFr, LIMITS_OPTIONS.text) ?? '';
      const titleAr = str(item.titleAr, LIMITS_OPTIONS.label) ?? '';
      const textAr = str(item.textAr, LIMITS_OPTIONS.text) ?? '';
      if ((titleFr || titleAr) && (textFr || textAr)) conditions.push({ titleFr, textFr, titleAr, textAr });
    }
  }

  return {
    v: 1,
    legal,
    clientFields,
    sections,
    extraFields,
    franchiseText: str(raw.franchiseText, LIMITS_OPTIONS.text) ?? base.franchiseText,
    conditions: Array.isArray(raw.conditions) ? conditions : base.conditions,
  };
}

const row = (label: string, value: string, optional = false): FieldRow => ({ label, value, ...(optional ? { optional: true } : {}) });

/** Ligne de mentions légales : seules les informations renseignées apparaissent (ex. « Patente : 123 - R.C : 456 »). */
export function legalLine(legal: LegalInfo): string {
  return [
    legal.patente.trim() && `Patente : ${legal.patente.trim()}`,
    legal.rc.trim() && `R.C : ${legal.rc.trim()}`,
    legal.if.trim() && `I.F : ${legal.if.trim()}`,
    legal.cnss.trim() && `C.N.S.S : ${legal.cnss.trim()}`,
  ]
    .filter(Boolean)
    .join('  -  ');
}

/** Fabrique le modèle de contrat (carnet de location) à partir des réglages. `agencyLines` : lignes d'en-tête de l'agence. */
export function templateFromOptions(options: ContractOptions, agencyLines: string[]): ContractTemplate {
  const { clientFields: f, sections: s } = options;
  const blocks: Block[] = [];

  blocks.push({ type: 'header', logo: 'left', center: agencyLines.join('\n'), right: 'Tél : {{agence_telephone}}\n{{agence_email}}' });
  blocks.push({ type: 'heading', text: 'CONTRAT DE LOCATION  N° {{numero}}', size: 'xl', bold: true, align: 'center', border: 'none' });

  const driverRows: FieldRow[] = [
    row('Nom', '{{client_nom_famille}}'),
    row('Prénom', '{{client_prenom}}'),
    ...(f.naissance ? [row('Date de naissance', '{{client_naissance}}')] : []),
    ...(f.nationalite ? [row('Nationalité', '{{client_nationalite}}')] : []),
    row('Adresse au Maroc', '{{client_adresse}}'),
    ...(f.adresseEtranger ? [row("Adresse à l'étranger", '')] : []),
    ...(f.hotel ? [row('Hôtel / N° de chambre', '')] : []),
    row('Tél', '{{client_telephone}}'),
    row('Permis de conduire N°', '{{client_permis}}'),
    row('Délivré le / à', '{{client_permis_delivre_le}}  à  {{client_permis_delivre_a}}'),
    ...(f.cin ? [row('C.I.N N°', '{{client_cin}}')] : []),
    ...(f.passeport ? [row('Passeport N°', '{{client_passeport}}')] : []),
    ...options.extraFields.map((label) => row(label, '')),
  ];
  blocks.push({ type: 'box', width: 'half', title: 'Conducteur 1', rows: driverRows });
  blocks.push({
    type: 'box',
    width: 'half',
    title: 'Véhicule et période',
    rows: [
      row('Marque', '{{marque}} {{modele}}'),
      row('Immatriculation', '{{immatriculation}}'),
      row('Départ (lieu, date et heure)', '{{date_debut}}'),
      row('Retour (lieu, date et heure)', '{{date_fin}}'),
    ],
  });

  if (s.conducteur2) {
    blocks.push({
      type: 'box',
      width: 'half',
      title: 'Conducteur 2',
      rows: [
        row('Nom', '{{conducteur2_nom}}'),
        row('Permis de conduire N°', '{{conducteur2_permis}}'),
        row('C.I.N N°', '{{conducteur2_cin}}'),
        row('Conducteur principal', '{{conducteur_principal}}', true),
        row('Conducteurs supplémentaires', '{{autres_conducteurs}}', true),
      ],
    });
  }
  if (s.paiement) {
    blocks.push({
      type: 'box',
      width: 'half',
      title: 'Paiement',
      rows: [
        row('Prix unitaire / jour', '{{prix_jour}}'),
        row('Nombre de jours', '{{nombre_jours}}'),
        row('Total général', '{{prix_total}}'),
        row('Caution', '{{caution}}'),
        row('Avance', '{{avance}}'),
        row('Reste', '{{reste}}'),
        row('Mode de paiement', '{{mode_paiement}}'),
      ],
    });
  }
  if (s.kilometrage) {
    blocks.push({
      type: 'box',
      width: 'half',
      title: 'Kilométrage',
      rows: [row('Km au départ', '{{km_depart}}'), row('Km au retour', '{{km_retour}}'), row('Carburant au départ', '{{carburant_depart}}')],
    });
  }
  if (s.carburant) blocks.push({ type: 'fuelGauge', width: 'half', title: 'Niveau de carburant' });

  if (s.etatVehicule) {
    blocks.push({ type: 'vehicleDiagram', title: 'État du véhicule (Départ)' });
    blocks.push({ type: 'vehicleDiagram', title: 'État du véhicule (Retour)' });
  }
  blocks.push({
    type: 'box',
    showIf: 'hasDeparture',
    title: 'État des lieux au départ',
    rows: [row('État général', '{{etat_depart}}'), row('Accessoires remis', '{{accessoires_depart}}'), row('Observations', '{{observations_depart}}', true)],
  });
  blocks.push({ type: 'box', showIf: 'hasConditions', title: 'Conditions particulières', rows: [], text: '{{conditions_particulieres}}' });
  if (s.franchise && options.franchiseText.trim()) blocks.push({ type: 'box', title: 'Franchise sinistre', rows: [], text: options.franchiseText });

  blocks.push({ type: 'paragraph', text: CONTRACT_ACCEPTANCE.fr, size: 'sm' });
  blocks.push({ type: 'paragraph', text: CONTRACT_ACCEPTANCE.ar, size: 'sm', rtl: true, align: 'right' });
  blocks.push({
    type: 'signatures',
    boxes: [
      { role: 'client', label: 'Signature du locataire · توقيع المكتري' },
      { role: 'agency', label: "Cachet et signature de l'agence · طابع وتوقيع الوكالة" },
    ],
  });
  const legal = legalLine(options.legal);
  if (legal) blocks.push({ type: 'paragraph', text: legal, size: 'sm', bold: true, align: 'center' });

  if (s.conditions && options.conditions.length > 0) {
    blocks.push({ type: 'pageBreak' });
    blocks.push({ type: 'heading', text: 'Conditions générales · الشروط العامة', size: 'lg', bold: true, align: 'center', border: 'bottom' });
    options.conditions.forEach((condition, index) => {
      blocks.push({
        type: 'columns',
        cells: [
          ...(condition.textFr || condition.titleFr ? [{ title: `Article ${index + 1}${condition.titleFr ? ` — ${condition.titleFr}` : ''}`, text: condition.textFr, lang: 'fr' as const }] : []),
          ...(condition.textAr || condition.titleAr ? [{ title: `المادة ${index + 1}${condition.titleAr ? ` — ${condition.titleAr}` : ''}`, text: condition.textAr, rtl: true, align: 'right' as const, lang: 'ar' as const }] : []),
        ],
      });
    });
  }

  return { v: 1, direction: 'ltr', blocks };
}

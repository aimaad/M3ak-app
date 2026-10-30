/**
 * Modèle de contrat d'une agence : une liste de blocs (titres, paragraphes, tableaux de champs, colonnes, zones de
 * signature…) avec des champs automatiques entre doubles accolades (ex. {{client_nom}}). C'est un format de DONNÉES,
 * jamais du HTML ni du code : tout contenu venant de la base ou d'une IA est revalidé par `parseTemplate` (liste blanche
 * stricte, tailles bornées) avant d'être affiché, puis échappé au rendu.
 */
export type Align = 'left' | 'center' | 'right';
export type TextSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type Condition = 'hasDrivers' | 'hasConditions' | 'hasDeparture';
export type Lang = 'fr' | 'ar';

export type TextStyle = {
  align?: Align;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  uppercase?: boolean;
  size?: TextSize;
  color?: 'default' | 'muted' | 'accent';
  rtl?: boolean;
};

export type FieldRow = { label: string; value: string; optional?: boolean };
export type ColumnCell = { title?: string; text: string; align?: Align; rtl?: boolean; lang?: Lang };
export type SignatureBox = { role: 'client' | 'agency'; label: string };

type Common = { showIf?: Condition };
export type Block = Common &
  (
    | ({ type: 'heading'; text: string; border?: 'none' | 'bottom' | 'box' } & TextStyle)
    | ({ type: 'paragraph'; text: string; border?: 'none' | 'box' } & TextStyle)
    | ({ type: 'list'; items: string[]; numbered?: boolean } & TextStyle)
    | { type: 'fields'; columns?: 1 | 2; bordered?: boolean; rows: FieldRow[] }
    | { type: 'columns'; bordered?: boolean; cells: ColumnCell[] }
    | { type: 'header'; logo?: Align | 'none'; left?: string; center?: string; right?: string }
    /** Cadre de formulaire : bandeau de titre, lignes « libellé : valeur » à remplir, et/ou texte libre. Deux cadres `half` consécutifs sont côte à côte. */
    | { type: 'box'; title?: string; width?: 'half' | 'full'; rows: FieldRow[]; text?: string }
    /** Schéma du véhicule vu de dessus pour marquer les dommages à la main, avec sa légende. */
    | { type: 'vehicleDiagram'; title: string; legend?: string; width?: 'half' | 'full' }
    /** Jauge de carburant (0, 1/4, 2/4, 3/4, 4/4) à cocher à la main. */
    | { type: 'fuelGauge'; title?: string; width?: 'half' | 'full' }
    | { type: 'signatures'; boxes: SignatureBox[] }
    | { type: 'rule' }
    | { type: 'spacer'; size?: 'sm' | 'md' | 'lg' }
    | { type: 'pageBreak' }
  );

export type ContractTemplate = { v: 1; direction: 'ltr' | 'rtl'; blocks: Block[] };

/** Champs automatiques disponibles dans un modèle. Un champ inconnu devient une ligne à remplir à la main. */
export const PLACEHOLDERS = [
  'numero', 'date_contrat', 'ville_contrat',
  'agence_nom', 'agence_raison_sociale', 'agence_adresse', 'agence_adresse_complete', 'agence_ville', 'agence_telephone', 'agence_email',
  'client_nom', 'client_cin', 'client_telephone',
  'conducteur_principal', 'autres_conducteurs',
  'vehicule', 'marque', 'modele', 'immatriculation',
  'date_debut', 'date_fin', 'prix_total', 'caution',
  'etat_depart', 'accessoires_depart', 'observations_depart', 'conditions_particulieres',
  'client_prenom', 'client_nom_famille', 'client_naissance', 'client_nationalite', 'client_adresse',
  'client_permis', 'client_permis_delivre_le', 'client_permis_delivre_a', 'client_passeport',
  'conducteur2_prenom', 'conducteur2_nom', 'conducteur2_permis', 'conducteur2_cin',
  'prix_jour', 'nombre_jours', 'avance', 'reste', 'mode_paiement',
  'km_depart', 'km_retour', 'carburant_depart', 'dommages_depart',
] as const;
export type Placeholder = (typeof PLACEHOLDERS)[number];
const PLACEHOLDER_SET = new Set<string>(PLACEHOLDERS);

export const LIMITS = { blocks: 400, text: 8000, items: 80, rows: 60, cells: 3, label: 200 } as const;

const BLANK = '…………………';

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const oneOf = <T extends string>(value: unknown, allowed: readonly T[]): T | undefined => (allowed.includes(value as T) ? (value as T) : undefined);
const text = (value: unknown, max: number = LIMITS.text): string | null => (typeof value === 'string' ? value.slice(0, max) : null);
const bool = (value: unknown): boolean | undefined => (typeof value === 'boolean' ? value : undefined);

function style(raw: Record<string, unknown>): TextStyle {
  const out: TextStyle = {};
  const align = oneOf(raw.align, ['left', 'center', 'right'] as const);
  const size = oneOf(raw.size, ['xs', 'sm', 'md', 'lg', 'xl'] as const);
  const color = oneOf(raw.color, ['default', 'muted', 'accent'] as const);
  if (align) out.align = align;
  if (size) out.size = size;
  if (color) out.color = color;
  for (const key of ['bold', 'italic', 'underline', 'uppercase', 'rtl'] as const) {
    const value = bool(raw[key]);
    if (value !== undefined) out[key] = value;
  }
  return out;
}

function parseBlock(raw: unknown): Block | null {
  if (!isObject(raw)) return null;
  const showIf = oneOf(raw.showIf, ['hasDrivers', 'hasConditions', 'hasDeparture'] as const);
  const common: Common = showIf ? { showIf } : {};

  switch (raw.type) {
    case 'heading':
    case 'paragraph': {
      const body = text(raw.text);
      if (body === null) return null;
      const border = oneOf(raw.border, raw.type === 'heading' ? (['none', 'bottom', 'box'] as const) : (['none', 'box'] as const));
      return { ...common, ...style(raw), type: raw.type, text: body, ...(border ? { border } : {}) } as Block;
    }
    case 'list': {
      if (!Array.isArray(raw.items) || raw.items.length > LIMITS.items) return null;
      const items = raw.items.map((item) => text(item, 2000));
      if (items.some((item) => item === null) || items.length === 0) return null;
      return { ...common, ...style(raw), type: 'list', items: items as string[], ...(raw.numbered === true ? { numbered: true } : {}) };
    }
    case 'fields': {
      if (!Array.isArray(raw.rows) || raw.rows.length === 0 || raw.rows.length > LIMITS.rows) return null;
      const rows: FieldRow[] = [];
      for (const row of raw.rows) {
        if (!isObject(row)) return null;
        const label = text(row.label, LIMITS.label);
        const value = text(row.value, 2000);
        if (label === null || value === null) return null;
        rows.push({ label, value, ...(row.optional === true ? { optional: true } : {}) });
      }
      return { ...common, type: 'fields', rows, columns: raw.columns === 2 ? 2 : 1, ...(raw.bordered === true ? { bordered: true } : {}) };
    }
    case 'columns': {
      if (!Array.isArray(raw.cells) || raw.cells.length === 0 || raw.cells.length > LIMITS.cells) return null;
      const cells: ColumnCell[] = [];
      for (const cell of raw.cells) {
        if (!isObject(cell)) return null;
        const body = text(cell.text);
        if (body === null) return null;
        const title = text(cell.title, LIMITS.label);
        const align = oneOf(cell.align, ['left', 'center', 'right'] as const);
        const lang = oneOf(cell.lang, ['fr', 'ar'] as const);
        cells.push({ text: body, ...(title ? { title } : {}), ...(align ? { align } : {}), ...(cell.rtl === true ? { rtl: true } : {}), ...(lang ? { lang } : {}) });
      }
      return { ...common, type: 'columns', cells, ...(raw.bordered === true ? { bordered: true } : {}) };
    }
    case 'header': {
      const logo = oneOf(raw.logo, ['left', 'center', 'right', 'none'] as const);
      const parts = { left: text(raw.left, 1000), center: text(raw.center, 1000), right: text(raw.right, 1000) };
      return {
        ...common,
        type: 'header',
        ...(logo ? { logo } : {}),
        ...(parts.left ? { left: parts.left } : {}),
        ...(parts.center ? { center: parts.center } : {}),
        ...(parts.right ? { right: parts.right } : {}),
      };
    }
    case 'box': {
      const rowsRaw = Array.isArray(raw.rows) ? raw.rows : [];
      if (rowsRaw.length > LIMITS.rows) return null;
      const rows: FieldRow[] = [];
      for (const row of rowsRaw) {
        if (!isObject(row)) return null;
        const label = text(row.label, LIMITS.label);
        const value = text(row.value, 2000);
        if (label === null || value === null) return null;
        rows.push({ label, value, ...(row.optional === true ? { optional: true } : {}) });
      }
      const title = text(raw.title, LIMITS.label);
      const body = text(raw.text);
      if (rows.length === 0 && !body) return null;
      return { ...common, type: 'box', rows, width: raw.width === 'half' ? 'half' : 'full', ...(title ? { title } : {}), ...(body ? { text: body } : {}) };
    }
    case 'vehicleDiagram': {
      const title = text(raw.title, LIMITS.label);
      if (title === null) return null;
      const legend = text(raw.legend, 500);
      return { ...common, type: 'vehicleDiagram', title, width: raw.width === 'half' ? 'half' : 'full', ...(legend ? { legend } : {}) };
    }
    case 'fuelGauge': {
      const title = text(raw.title, LIMITS.label);
      return { ...common, type: 'fuelGauge', width: raw.width === 'half' ? 'half' : 'full', ...(title ? { title } : {}) };
    }
    case 'signatures': {
      if (!Array.isArray(raw.boxes) || raw.boxes.length === 0 || raw.boxes.length > 4) return null;
      const boxes: SignatureBox[] = [];
      for (const box of raw.boxes) {
        if (!isObject(box)) return null;
        const role = oneOf(box.role, ['client', 'agency'] as const);
        const label = text(box.label, LIMITS.label);
        if (!role || label === null) return null;
        boxes.push({ role, label });
      }
      return { ...common, type: 'signatures', boxes };
    }
    case 'rule':
      return { ...common, type: 'rule' };
    case 'pageBreak':
      return { ...common, type: 'pageBreak' };
    case 'spacer': {
      const size = oneOf(raw.size, ['sm', 'md', 'lg'] as const);
      return { ...common, type: 'spacer', ...(size ? { size } : {}) };
    }
    default:
      return null;
  }
}

/** Valide un modèle inconnu (réponse d'IA, ligne de base). Les blocs invalides sont ignorés ; null si rien d'exploitable. */
export function parseTemplate(raw: unknown): ContractTemplate | null {
  if (!isObject(raw) || !Array.isArray(raw.blocks)) return null;
  const blocks = raw.blocks.slice(0, LIMITS.blocks).map(parseBlock).filter((block): block is Block => block !== null);
  if (blocks.length === 0) return null;
  return { v: 1, direction: raw.direction === 'rtl' ? 'rtl' : 'ltr', blocks };
}

/** Un modèle sans zone de signature ne peut pas servir : on la rajoute en fin de document. */
export function ensureSignatures(template: ContractTemplate): ContractTemplate {
  if (template.blocks.some((block) => block.type === 'signatures')) return template;
  return {
    ...template,
    blocks: [
      ...template.blocks,
      { type: 'spacer', size: 'md' },
      { type: 'signatures', boxes: [{ role: 'client', label: 'Le locataire' }, { role: 'agency', label: "Pour l'agence" }] },
    ],
  };
}

export type TemplateValues = Partial<Record<Placeholder, string>>;

/** Remplace {{champ}}. Champ vide ou inconnu → ligne à remplir à la main (jamais un texte technique). */
export function fillPlaceholders(input: string, values: TemplateValues): string {
  return input.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/g, (_, key: string) => {
    if (!PLACEHOLDER_SET.has(key)) return BLANK;
    return values[key as Placeholder]?.trim() || BLANK;
  });
}

/** Vrai si la ligne reste vide une fois les champs remplis (pour masquer une rubrique facultative). */
export function isEmptyFilled(input: string, values: TemplateValues): boolean {
  const filled = input.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/g, (_, key: string) => (PLACEHOLDER_SET.has(key) ? values[key as Placeholder]?.trim() || '' : ''));
  return filled.trim() === '';
}

export type TemplateContext = { hasDrivers: boolean; hasConditions: boolean; hasDeparture: boolean };

export function blockVisible(block: Block, context: TemplateContext): boolean {
  if (!block.showIf) return true;
  return context[block.showIf];
}

/** Texte brut d'un modèle, dans l'ordre, pour la lecture avant signature dans l'app. */
export type ReadingSection = { title?: string; text: string; rtl: boolean; lang?: Lang };

export function readingSections(template: ContractTemplate, values: TemplateValues, context: TemplateContext): ReadingSection[] {
  const rtlDefault = template.direction === 'rtl';
  const out: ReadingSection[] = [];
  for (const block of template.blocks) {
    if (!blockVisible(block, context)) continue;
    switch (block.type) {
      case 'heading':
        out.push({ title: fillPlaceholders(block.text, values), text: '', rtl: block.rtl ?? rtlDefault });
        break;
      case 'paragraph':
        out.push({ text: fillPlaceholders(block.text, values), rtl: block.rtl ?? rtlDefault });
        break;
      case 'list':
        out.push({ text: block.items.map((item, i) => `${block.numbered ? `${i + 1}.` : '•'} ${fillPlaceholders(item, values)}`).join('\n'), rtl: block.rtl ?? rtlDefault });
        break;
      case 'fields': {
        const lines = block.rows
          .filter((row) => !(row.optional && isEmptyFilled(row.value, values)))
          .map((row) => `${row.label} : ${fillPlaceholders(row.value, values)}`);
        if (lines.length > 0) out.push({ text: lines.join('\n'), rtl: rtlDefault });
        break;
      }
      case 'columns':
        for (const cell of block.cells) {
          out.push({ ...(cell.title ? { title: fillPlaceholders(cell.title, values) } : {}), text: fillPlaceholders(cell.text, values), rtl: cell.rtl ?? rtlDefault, ...(cell.lang ? { lang: cell.lang } : {}) });
        }
        break;
      case 'box': {
        const lines = block.rows
          .filter((row) => !(row.optional && isEmptyFilled(row.value, values)))
          .map((row) => `${row.label} : ${fillPlaceholders(row.value, values)}`);
        const body = block.text ? fillPlaceholders(block.text, values) : '';
        out.push({ ...(block.title ? { title: fillPlaceholders(block.title, values) } : {}), text: [...lines, body].filter(Boolean).join('\n'), rtl: rtlDefault });
        break;
      }
      case 'header':
        {
          const lines = [block.left, block.center, block.right].filter((part): part is string => !!part).map((part) => fillPlaceholders(part, values));
          if (lines.length > 0) out.push({ text: lines.join('\n'), rtl: rtlDefault });
        }
        break;
      default:
        break;
    }
  }
  return out;
}

export function hasLanguageToggle(sections: ReadingSection[]): boolean {
  return sections.some((section) => section.lang === 'fr') && sections.some((section) => section.lang === 'ar');
}

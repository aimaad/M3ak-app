import { stampSvg, type StampConfig } from '@/features/agency/stamp';
import { signatureToSvg, type HandwrittenSignature } from '@/features/signatures/signature';

import {
  blockVisible,
  fillPlaceholders,
  isEmptyFilled,
  type Align,
  type Block,
  type ContractTemplate,
  type TemplateContext,
  type TemplateValues,
  type TextStyle,
} from './template';

export function escapeHtml(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Image intégrée au PDF : seules les images png/jpeg encodées en base64 passent, tout le reste est ignoré. */
const IMAGE_PATTERN = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/;
export const safeImage = (uri: string | null | undefined): string | null => (uri && IMAGE_PATTERN.test(uri) ? uri : null);

export type RenderInput = {
  values: TemplateValues;
  context: TemplateContext;
  clientName: string;
  agencyName: string;
  agencySignerName?: string | null;
  clientSignedAtLabel?: string | null;
  agencySignedAtLabel?: string | null;
  signatures?: { client?: HandwrittenSignature | null; agency?: HandwrittenSignature | null };
  stampDataUri?: string | null;
  /** Cachet généré par M3ak : dessiné en vectoriel sur le contrat (prioritaire sur la photo). */
  stampConfig?: StampConfig | null;
  logoDataUri?: string | null;
};

/** Vrai si tous les champs {{…}} de la ligne sont vides ou inconnus. */
function hasOnlyEmptyFields(line: string, values: TemplateValues): boolean {
  return [...line.matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/g)].every((match) => !(values as Record<string, string | undefined>)[match[1]]?.trim());
}

const SIZE_PX = { xs: 9, sm: 11, md: 12, lg: 15, xl: 20 } as const;
const COLOR = { default: '#211A2E', muted: '#81778F', accent: '#5B21B6' } as const;

function html(text: string, values: TemplateValues): string {
  return escapeHtml(fillPlaceholders(text, values)).replace(/\n/g, '<br />');
}

function styleAttr(style: TextStyle, defaultRtl: boolean, extra = ''): string {
  const rtl = style.rtl ?? false;
  const align: Align | undefined = style.align ?? (rtl && !defaultRtl ? 'right' : undefined);
  const parts = [
    style.size ? `font-size:${SIZE_PX[style.size]}px` : '',
    style.color ? `color:${COLOR[style.color]}` : '',
    style.bold ? 'font-weight:bold' : '',
    style.italic ? 'font-style:italic' : '',
    style.underline ? 'text-decoration:underline' : '',
    style.uppercase ? 'text-transform:uppercase' : '',
    align ? `text-align:${align}` : '',
    extra,
  ].filter(Boolean);
  return `${rtl ? ' dir="rtl"' : ''} style="${parts.join(';')}"`;
}

function borderClass(border: string | undefined): string {
  return border === 'box' ? ' boxed' : border === 'bottom' ? ' underlined' : '';
}

function signatureBox(label: string, role: 'client' | 'agency', input: RenderInput): string {
  const signature = role === 'client' ? input.signatures?.client : input.signatures?.agency;
  const svg = signature ? signatureToSvg(signature, 56) : '';
  const generated = role === 'agency' && input.stampConfig ? `<div class="stamp-svg">${stampSvg(input.stampConfig, input.stampConfig.shape === 'round' ? 104 : 132)}</div>` : '';
  const stamp = generated || (role === 'agency' && safeImage(input.stampDataUri) ? `<img class="stamp" src="${safeImage(input.stampDataUri)}" />` : '');
  const name = role === 'client' ? input.clientName : (input.agencySignerName ?? input.agencyName);
  const when = role === 'client' ? input.clientSignedAtLabel : input.agencySignedAtLabel;
  return `<div class="sign-box">
    <div class="sign-title">${escapeHtml(fillPlaceholders(label, input.values))}</div>
    <div class="sign-area">${svg}${stamp}</div>
    ${name ? `<div class="sign-name">${escapeHtml(name)}</div>` : ''}
    ${when ? `<div class="sign-date">${escapeHtml(when)}</div>` : ''}
  </div>`;
}

function renderBlock(block: Block, input: RenderInput, rtlDefault: boolean): string {
  const { values } = input;
  switch (block.type) {
    case 'heading': {
      const size = block.size ?? 'lg';
      return `<div class="heading${borderClass(block.border ?? 'bottom')}"${styleAttr({ ...block, size, bold: block.bold ?? true }, rtlDefault)}>${html(block.text, values)}</div>`;
    }
    case 'paragraph':
      return `<p class="para${borderClass(block.border)}"${styleAttr(block, rtlDefault)}>${html(block.text, values)}</p>`;
    case 'list': {
      const tag = block.numbered ? 'ol' : 'ul';
      return `<${tag} class="list"${styleAttr(block, rtlDefault)}>${block.items.map((item) => `<li>${html(item, values)}</li>`).join('')}</${tag}>`;
    }
    case 'fields': {
      const rows = block.rows.filter((row) => !(row.optional && isEmptyFilled(row.value, values)));
      if (rows.length === 0) return '';
      const cell = (row: (typeof rows)[number]) =>
        `<td class="label">${escapeHtml(row.label)}</td><td>${html(row.value, values)}</td>`;
      if (block.columns === 2) {
        const lines: string[] = [];
        for (let i = 0; i < rows.length; i += 2) lines.push(`<tr>${cell(rows[i])}${rows[i + 1] ? cell(rows[i + 1]) : '<td></td><td></td>'}</tr>`);
        return `<table class="fields${block.bordered ? ' bordered' : ''}">${lines.join('')}</table>`;
      }
      return `<table class="fields${block.bordered ? ' bordered' : ''}">${rows.map((row) => `<tr>${cell(row)}</tr>`).join('')}</table>`;
    }
    case 'columns':
      return `<table class="cols${block.bordered ? ' bordered' : ''}"><tr>${block.cells
        .map((cell) => {
          const rtl = cell.rtl === true;
          return `<td${rtl ? ' dir="rtl"' : ''} style="width:${Math.floor(100 / block.cells.length)}%;${cell.align ? `text-align:${cell.align}` : rtl ? 'text-align:right' : ''}">${
            cell.title ? `<b>${html(cell.title, values)}</b><br />` : ''
          }${html(cell.text, values)}</td>`;
        })
        .join('')}</tr></table>`;
    case 'header': {
      // Une ligne dont les champs sont tous vides (ex. adresse ou téléphone non renseignés) disparaît : pas de pointillés en en-tête.
      const keep = (text: string | undefined) => {
        if (!text) return undefined;
        const lines = text.split('\n').filter((line) => !/\{\{\s*[a-z0-9_]+\s*\}\}/.test(line) || !hasOnlyEmptyFields(line, values));
        return lines.length > 0 ? lines.join('\n') : undefined;
      };
      const logo = safeImage(input.logoDataUri);
      const place = block.logo && block.logo !== 'none' && logo ? block.logo : null;
      const img = logo ? `<img class="logo" src="${logo}" />` : '';
      const slot = (position: Align, text: string | undefined) =>
        `<td style="text-align:${position}">${place === position ? img : ''}${text ? `<div>${html(text, values)}</div>` : ''}</td>`;
      return `<table class="header"><tr>${slot('left', keep(block.left))}${slot('center', keep(block.center))}${slot('right', keep(block.right))}</tr></table>`;
    }
    case 'box': {
      const rows = block.rows.filter((row) => !(row.optional && isEmptyFilled(row.value, values)));
      const lines = rows
        .map((row) => `<div class="frow"><span class="flabel">${escapeHtml(row.label)}${row.label.trim() ? ' :' : ''}</span><span class="fvalue">${html(row.value, values)}</span></div>`)
        .join('');
      return `<div class="box">${block.title ? `<div class="banner">${html(block.title, values)}</div>` : ''}<div class="boxbody">${lines}${
        block.text ? `<div class="boxtext">${html(block.text, values)}</div>` : ''
      }</div></div>`;
    }
    case 'vehicleDiagram':
      return `<div class="box"><div class="boxbody diagram"><div class="diagram-svg">${CAR_SVG}</div><div class="diagram-side"><div class="banner dark">${html(block.title, values)}</div><div class="legend">${html(block.legend ?? 'R: rayures\nB: bosses\nE: éclats\nC: cassures', values)}</div></div></div></div>`;
    case 'fuelGauge':
      return `<div class="box"><div class="boxbody gauge">${block.title ? `<div class="gauge-title">${html(block.title, values)}</div>` : ''}${gaugeSvg(fuelPercent(values.carburant_depart))}</div></div>`;
    case 'signatures':
      return `<div class="signatures">${block.boxes.map((box) => signatureBox(box.label, box.role, input)).join('')}</div>`;
    case 'rule':
      return '<hr />';
    case 'spacer':
      return `<div style="height:${block.size === 'lg' ? 28 : block.size === 'sm' ? 6 : 14}px"></div>`;
    case 'pageBreak':
      return '';
    default:
      return '';
  }
}

const CAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 150" width="70" height="116"><rect x="12" y="8" width="66" height="134" rx="26" fill="none" stroke="#211A2E" stroke-width="2.5"/><rect x="22" y="34" width="46" height="26" rx="6" fill="none" stroke="#211A2E" stroke-width="2"/><rect x="22" y="92" width="46" height="24" rx="6" fill="none" stroke="#211A2E" stroke-width="2"/><rect x="4" y="30" width="9" height="20" rx="3" fill="#211A2E"/><rect x="77" y="30" width="9" height="20" rx="3" fill="#211A2E"/><rect x="4" y="100" width="9" height="20" rx="3" fill="#211A2E"/><rect x="77" y="100" width="9" height="20" rx="3" fill="#211A2E"/><line x1="45" y1="62" x2="45" y2="90" stroke="#211A2E" stroke-width="1.5"/></svg>`;

const GAUGE_BASE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 84" width="150" height="80"><path d="M16 70 A64 64 0 0 1 144 70" fill="none" stroke="#211A2E" stroke-width="2.5"/><line x1="80" y1="70" x2="80" y2="12" stroke="#211A2E" stroke-width="1.5"/><line x1="35" y1="25" x2="42" y2="33" stroke="#211A2E" stroke-width="1.5"/><line x1="125" y1="25" x2="118" y2="33" stroke="#211A2E" stroke-width="1.5"/><text x="8" y="82" font-size="10" fill="#211A2E">0</text><text x="12" y="34" font-size="10" fill="#211A2E">1/4</text><text x="68" y="10" font-size="10" fill="#211A2E">2/4</text><text x="122" y="34" font-size="10" fill="#211A2E">3/4</text><text x="142" y="82" font-size="10" fill="#211A2E">4/4</text>`;
/** Lit « 50 % » (ou 50) et renvoie un pourcentage entre 0 et 100, ou null si le niveau n'est pas connu. */
export function fuelPercent(raw: string | undefined | null): number | null {
  const match = /(\d+(?:[.,]\d+)?)/.exec(raw ?? '');
  if (!match) return null;
  const value = Number(match[1].replace(',', '.'));
  return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : null;
}

/** Jauge dessinée avec l'aiguille et l'arc rempli au niveau relevé au départ ; vide à cocher à la main si inconnu. */
export function gaugeSvg(percent: number | null): string {
  if (percent == null) return GAUGE_BASE + '</svg>';
  const angle = Math.PI * (1 - percent / 100);
  const x = (80 + 58 * Math.cos(angle)).toFixed(1);
  const y = (70 - 58 * Math.sin(angle)).toFixed(1);
  const needle = `<line x1="80" y1="70" x2="${x}" y2="${y}" stroke="#B91C1C" stroke-width="3" stroke-linecap="round"/><circle cx="80" cy="70" r="4" fill="#B91C1C"/>`;
  const arc = percent > 0 ? `<path d="M16 70 A64 64 0 0 1 ${(80 + 64 * Math.cos(angle)).toFixed(1)} ${(70 - 64 * Math.sin(angle)).toFixed(1)}" fill="none" stroke="#B91C1C" stroke-width="5" opacity="0.35"/>` : '';
  return GAUGE_BASE.replace('<line x1="80" y1="70" x2="80" y2="12" stroke="#211A2E" stroke-width="1.5"/>', '') + arc + needle + `<text x="80" y="82" font-size="9" font-weight="bold" text-anchor="middle" fill="#B91C1C">${Math.round(percent)} %</text></svg>`;
}


/** Feuille A4 en pixels CSS (96 dpi) : 794 × 1123. L'impression, elle, est demandée en points : 595 × 842 (`PRINT_SIZE`). */
export const PAGE = { width: 794, height: 1123, padX: 36, padY: 30 } as const;
export const PRINT_SIZE = { width: 595, height: 842 } as const;
const CONTENT_W = PAGE.width - 2 * PAGE.padX; // 722
/**
 * Hauteur d'une feuille : volontairement un peu plus courte que la page (1123 px) — la page réelle d'un téléphone mesure
 * ~1122,7 px, et une feuille de 1123 px laissait déborder une fraction de pixel sur une 3e page blanche.
 */
const SHEET_H = 1108;
const CONTENT_H = SHEET_H - 2 * PAGE.padY; // 1048
/** Le contenu peut être agrandi (jusqu'à ×1,3) pour bien remplir la feuille, ou réduit (jusqu'à ×0,45) pour y tenir. */
const MAX_ZOOM = 1.3;
/** Une feuille faite uniquement de conditions (le verso) peut être plus agrandie pour mieux remplir la page. */
const MAX_ZOOM_TERMS = 1.8;
const MIN_ZOOM = 0.45;

const CSS = `
  @page { size: ${PAGE.width}px ${PAGE.height}px; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Helvetica, Arial, sans-serif; color: #211A2E; font-size: 10px; line-height: 1.35; }
  .sheet { width: ${PAGE.width}px; height: ${SHEET_H}px; padding: ${PAGE.padY}px ${PAGE.padX}px; page-break-after: always; break-after: page; overflow: hidden; }
  html, body { margin: 0; padding: 0; }
  .fit { display: flex; flex-direction: column; justify-content: space-between; }
  .sheet.last { page-break-after: auto; break-after: auto; }
  .box { border: 1.2px solid #211A2E; border-radius: 5px; margin: 4px 0; overflow: hidden; }
  .banner { background: #211A2E; color: #fff; font-weight: bold; text-align: center; padding: 2px 6px; font-size: 10px; letter-spacing: .4px; text-transform: uppercase; }
  .banner.dark { border-radius: 10px; margin: 3px; }
  .boxbody { padding: 4px 6px; }
  .frow { display: flex; gap: 4px; padding: 1.5px 0; align-items: baseline; }
  .flabel { white-space: nowrap; font-size: 9.5px; }
  .fvalue { flex: 1; border-bottom: 1px dotted #7A7090; min-height: 12px; font-weight: bold; color: #1D3FA8; font-size: 9.5px; }
  .boxtext { font-size: 7.5px; line-height: 1.3; text-align: justify; }
  .pair { display: flex; gap: 8px; align-items: stretch; }
  .pair > * { flex: 1; min-width: 0; }
  .pair > .box { margin: 4px 0; }
  .diagram { display: flex; align-items: center; gap: 6px; }
  .diagram-svg svg { width: 52px; height: 87px; }
  .diagram-side { flex: 1; }
  .legend { white-space: pre-line; font-size: 9.5px; font-weight: bold; text-align: center; padding: 2px; }
  .gauge { text-align: center; }
  .gauge svg { width: 120px; height: 64px; }
  .gauge-title { font-size: 9.5px; font-weight: bold; }
  .heading { margin: 8px 0 4px; padding-bottom: 2px; }
  .underlined { border-bottom: 1px solid #EAE5F2; }
  .boxed { border: 1px solid #211A2E; padding: 4px 6px; }
  .para { margin: 4px 0; }
  .list { margin: 4px 0; padding-inline-start: 18px; }
  table { width: 100%; border-collapse: collapse; margin-top: 3px; }
  td { padding: 2px 0; vertical-align: top; }
  .fields td.label { color: #81778F; width: 24%; padding-inline-end: 6px; }
  table.bordered td { border: 1px solid #C9C0D8; padding: 3px 5px; }
  .cols td { padding: 4px 6px; border-bottom: 1px solid #EAE5F2; font-size: 8px; }
  .cols.bordered td { border: 1px solid #C9C0D8; }
  .terms td { padding: 4px 8px; font-size: 7px; line-height: 1.3; text-align: justify; }
  .terms td + td { border-inline-start: 1px solid #C9C0D8; }
  .terms .art { margin-bottom: 4px; }
  .header td { width: 33%; font-size: 10px; }
  .logo { max-height: 52px; max-width: 120px; object-fit: contain; }
  hr { border: 0; border-top: 1px solid #C9C0D8; margin: 6px 0; }
  .signatures { margin-top: 8px; display: flex; justify-content: space-between; gap: 16px; page-break-inside: avoid; }
  .sign-box { flex: 1; border: 1px solid #C9C0D8; border-radius: 5px; padding: 5px; font-size: 9px; text-align: center; }
  .sign-title { font-weight: bold; }
  .sign-area { position: relative; height: 96px; display: flex; align-items: center; justify-content: center; border-bottom: 1px solid #211A2E; margin: 4px 0 3px; }
  .stamp-svg { position: absolute; inset-inline-end: 4px; top: -2px; line-height: 0; }
  .stamp-svg svg { display: block; }
  .sign-area svg.sig { max-height: 58px; }
  .stamp { height: 80px; max-width: 95px; object-fit: contain; margin-inline-start: 6px; }
  .sign-name { font-weight: bold; }
  .sign-date { color: #81778F; font-size: 8px; }
`;

const isHalf = (block: Block) => (block.type === 'box' || block.type === 'fuelGauge' || block.type === 'vehicleDiagram') && block.width === 'half';

// ---------------------------------------------------------------------------------------------------------------
// Mise en page sur des feuilles A4 : le contenu est réduit (zoom) juste ce qu'il faut pour tenir sur la page.
// Hauteurs estimées en px ; constantes calibrées sur un rendu réel (Chromium), avec une petite marge de sécurité.
// ---------------------------------------------------------------------------------------------------------------
const SIZE_FONT = { xs: 9, sm: 10, md: 11, lg: 14, xl: 18 } as const;

function textLines(text: string, fontPx: number, widthPx: number): number {
  const perLine = Math.max(6, Math.floor(widthPx / (fontPx * 0.52)));
  return text.split('\n').reduce((total, line) => total + Math.max(1, Math.ceil(line.length / perLine)), 0);
}
const textHeight = (text: string, fontPx: number, widthPx: number, lineHeight = 1.35) => textLines(text, fontPx, widthPx) * fontPx * lineHeight;

type Unit = { html: string; height: (width: number) => number; terms?: boolean };

function blockUnit(block: Block, input: RenderInput, rtlDefault: boolean): Unit {
  const { values } = input;
  const fill = (text: string) => fillPlaceholders(text, values);
  const html = renderBlock(block, input, rtlDefault);
  let height: (width: number) => number;

  switch (block.type) {
    case 'header':
      height = (w) => Math.max(safeImage(input.logoDataUri) ? 56 : 0, ...[block.left, block.center, block.right].map((part) => (part ? textHeight(part.split('\n').filter((line) => !/\{\{/.test(line) || !hasOnlyEmptyFields(line, values)).map(fill).join('\n'), 10, w / 3) : 0))) + 10;
      break;
    case 'heading':
      height = (w) => textHeight(fill(block.text), SIZE_FONT[block.size ?? 'lg'], w, 1.3) + 14 + (block.border === 'box' ? 8 : 0);
      break;
    case 'paragraph':
      height = (w) => textHeight(fill(block.text), SIZE_FONT[block.size ?? 'sm'] ?? 10, w) + 8 + (block.border === 'box' ? 8 : 0);
      break;
    case 'list':
      height = (w) => block.items.reduce((sum, item) => sum + textHeight(`• ${fill(item)}`, SIZE_FONT[block.size ?? 'sm'] ?? 10, w - 18), 8);
      break;
    case 'fields':
      height = (w) => Math.ceil(block.rows.length / (block.columns === 2 ? 2 : 1)) * 16 + 6 + (w > 0 ? 0 : 0);
      break;
    case 'columns':
      height = (w) => Math.max(...block.cells.map((cell) => textHeight(`${cell.title ?? ''}\n${fill(cell.text)}`, 8, w / block.cells.length - 12))) + 10;
      break;
    case 'box': {
      const rows = block.rows.filter((row) => !(row.optional && isEmptyFilled(row.value, values)));
      height = (w) => {
        const inner = block.width === 'half' ? (w - 8) / 2 : w;
        return (block.title ? 17 : 0) + rows.length * 16 + (block.text ? textHeight(fill(block.text), 7.5, inner - 16, 1.3) + 4 : 0) + 8 + 8;
      };
      break;
    }
    case 'vehicleDiagram':
      height = () => 87 + 8 + 8;
      break;
    case 'fuelGauge':
      height = () => 64 + 14 + 8 + 8;
      break;
    case 'signatures':
      height = () => 96 + 14 + 24 + 12 + 10;
      break;
    case 'rule':
      height = () => 13;
      break;
    case 'spacer':
      height = () => (block.size === 'lg' ? 28 : block.size === 'sm' ? 6 : 14);
      break;
    default:
      height = () => 0;
  }
  return { html, height };
}

/** Plusieurs blocs « colonnes » de suite (les articles) forment un seul texte continu par langue : deux colonnes serrées sur la page. */
function termsUnit(blocks: Extract<Block, { type: 'columns' }>[], input: RenderInput): Unit {
  const { values } = input;
  const count = Math.max(...blocks.map((block) => block.cells.length));
  const columns = Array.from({ length: count }, (_, index) => blocks.map((block) => block.cells[index]).filter((cell): cell is NonNullable<typeof cell> => !!cell));
  const html = `<table class="terms"><tr>${columns
    .map((cells) => {
      const rtl = cells.some((cell) => cell.rtl);
      return `<td${rtl ? ' dir="rtl"' : ''} style="width:${Math.floor(100 / count)}%;${rtl ? 'text-align:right' : ''}">${cells
        .map((cell) => `<div class="art">${cell.title ? `<b>${escapeHtml(fillPlaceholders(cell.title, values))}</b> ` : ''}${escapeHtml(fillPlaceholders(cell.text, values)).replace(/\n/g, '<br />')}</div>`)
        .join('')}</td>`;
    })
    .join('')}</tr></table>`;
  const height = (w: number) =>
    Math.max(
      ...columns.map((cells) => cells.reduce((sum, cell) => sum + textHeight(`${cell.title ?? ''} ${fillPlaceholders(cell.text, values)}`, 7, w / count - 16, 1.3) + 4, 0))
    ) * 0.93 + 12; // le texte réel est ~7 % moins haut que l'estimation (mesuré)
  return { html, height, terms: true };
}

function pageUnits(blocks: Block[], input: RenderInput, rtlDefault: boolean): Unit[] {
  const units: Unit[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block.type === 'columns') {
      const run: Extract<Block, { type: 'columns' }>[] = [block];
      while (blocks[i + 1]?.type === 'columns') run.push(blocks[++i] as Extract<Block, { type: 'columns' }>);
      units.push(termsUnit(run, input));
    } else if (isHalf(block) && blocks[i + 1] && isHalf(blocks[i + 1])) {
      const left = blockUnit(block, input, rtlDefault);
      const right = blockUnit(blocks[i + 1], input, rtlDefault);
      units.push({ html: `<div class="pair">${left.html}${right.html}</div>`, height: (w) => Math.max(left.height(w), right.height(w)) });
      i++;
    } else {
      units.push(blockUnit(block, input, rtlDefault));
    }
  }
  return units;
}

/** Plus grand zoom pour lequel la page entière tient sur une feuille. Contenu serré au-delà de 0,45 : il déborde alors sur une page de plus. */
export function fitScale(units: Pick<Unit, 'height'>[], maxZoom: number = MAX_ZOOM): number {
  for (let scale = maxZoom; scale >= MIN_ZOOM; scale = Math.round((scale - 0.02) * 100) / 100) {
    const width = CONTENT_W / scale;
    const visible = units.reduce((sum, unit) => sum + unit.height(width), 0) * scale * 1.05;
    if (visible <= CONTENT_H) return scale;
  }
  return MIN_ZOOM;
}

/** Hauteur estimée (px) de chaque feuille avant réduction, pour la largeur de contenu donnée (utilisé par les tests de calibrage). */
export function estimateSheetHeights(template: ContractTemplate, input: RenderInput, width: number = CONTENT_W): number[] {
  const rtlDefault = template.direction === 'rtl';
  const pages: Block[][] = [[]];
  for (const block of template.blocks.filter((b) => blockVisible(b, input.context))) {
    if (block.type === 'pageBreak') pages.push([]);
    else pages[pages.length - 1].push(block);
  }
  return pages.filter((blocks) => blocks.length > 0).map((blocks) => Math.round(pageUnits(blocks, input, rtlDefault).reduce((sum, unit) => sum + unit.height(width), 0)));
}

/**
 * Filet de sécurité exécuté par le moteur d'impression du téléphone : les hauteurs ci-dessus sont des estimations, et les
 * polices d'un iPhone ou d'un Android ne sont pas celles de nos mesures. Si une feuille déborde malgré tout, on réduit
 * son zoom jusqu'à ce qu'elle tienne — jamais de 3e page. (Sans script, les marges de l'estimation et `overflow: hidden`
 * sur la feuille empêchent déjà tout débordement vers une page de plus.)
 */
const FIT_SCRIPT = `(function(){try{var H=${CONTENT_H};document.querySelectorAll('.sheet').forEach(function(sheet){var fit=sheet.querySelector('.fit');if(!fit)return;var z=parseFloat(fit.style.zoom||'1');var n=0;while(sheet.scrollHeight>sheet.clientHeight+2&&z>${MIN_ZOOM}&&n++<60){z=Math.round((z-0.02)*100)/100;fit.style.zoom=String(z);fit.style.minHeight=(Math.floor(H/z)-4)+'px';}});}catch(e){}})();`;

/** Cadres de blocs séparés par des « sauts de page » : le recto (page principale) puis le verso (conditions), chacun sur UNE feuille. */
export function renderTemplateHtml(template: ContractTemplate, input: RenderInput): string {
  const rtlDefault = template.direction === 'rtl';
  const visible = template.blocks.filter((block) => blockVisible(block, input.context));
  const pages: Block[][] = [[]];
  for (const block of visible) {
    if (block.type === 'pageBreak') pages.push([]);
    else pages[pages.length - 1].push(block);
  }
  const sheets = pages
    .filter((blocks) => blocks.length > 0)
    .map((blocks, index, all) => {
      const units = pageUnits(blocks, input, rtlDefault);
      const scale = fitScale(units, units.some((unit) => unit.terms) ? MAX_ZOOM_TERMS : MAX_ZOOM);
      // Hauteur minimale = toute la feuille : les rubriques se répartissent sur la page au lieu d'être serrées en haut.
      const minHeight = Math.floor(CONTENT_H / scale) - 4;
      return `<section class="sheet${index === all.length - 1 ? ' last' : ''}"><div class="fit" style="${scale !== 1 ? `zoom:${scale};` : ''}min-height:${minHeight}px">${units.map((unit) => unit.html).join('\n')}</div></section>`;
    });
  return `<html><head><meta charset="utf-8" /><style>${CSS}</style></head><body dir="${rtlDefault ? 'rtl' : 'ltr'}">${sheets.join('\n')}<script>${FIT_SCRIPT}</script></body></html>`;
}

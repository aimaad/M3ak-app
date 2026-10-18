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
  logoDataUri?: string | null;
};

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
  const svg = signature ? signatureToSvg(signature, 70) : '';
  const stamp = role === 'agency' && safeImage(input.stampDataUri) ? `<img class="stamp" src="${safeImage(input.stampDataUri)}" />` : '';
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
      const logo = safeImage(input.logoDataUri);
      const place = block.logo && block.logo !== 'none' && logo ? block.logo : null;
      const img = logo ? `<img class="logo" src="${logo}" />` : '';
      const slot = (position: Align, text: string | undefined) =>
        `<td style="text-align:${position}">${place === position ? img : ''}${text ? `<div>${html(text, values)}</div>` : ''}</td>`;
      return `<table class="header"><tr>${slot('left', block.left)}${slot('center', block.center)}${slot('right', block.right)}</tr></table>`;
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
      return `<div class="box"><div class="boxbody gauge">${block.title ? `<div class="gauge-title">${html(block.title, values)}</div>` : ''}${GAUGE_SVG}</div></div>`;
    case 'signatures':
      return `<div class="signatures">${block.boxes.map((box) => signatureBox(box.label, box.role, input)).join('')}</div>`;
    case 'rule':
      return '<hr />';
    case 'spacer':
      return `<div style="height:${block.size === 'lg' ? 28 : block.size === 'sm' ? 6 : 14}px"></div>`;
    case 'pageBreak':
      return '<div style="page-break-after:always"></div>';
    default:
      return '';
  }
}

const CAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 150" width="70" height="116"><rect x="12" y="8" width="66" height="134" rx="26" fill="none" stroke="#211A2E" stroke-width="2.5"/><rect x="22" y="34" width="46" height="26" rx="6" fill="none" stroke="#211A2E" stroke-width="2"/><rect x="22" y="92" width="46" height="24" rx="6" fill="none" stroke="#211A2E" stroke-width="2"/><rect x="4" y="30" width="9" height="20" rx="3" fill="#211A2E"/><rect x="77" y="30" width="9" height="20" rx="3" fill="#211A2E"/><rect x="4" y="100" width="9" height="20" rx="3" fill="#211A2E"/><rect x="77" y="100" width="9" height="20" rx="3" fill="#211A2E"/><line x1="45" y1="62" x2="45" y2="90" stroke="#211A2E" stroke-width="1.5"/></svg>`;

const GAUGE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 84" width="150" height="80"><path d="M16 70 A64 64 0 0 1 144 70" fill="none" stroke="#211A2E" stroke-width="2.5"/><line x1="80" y1="70" x2="80" y2="12" stroke="#211A2E" stroke-width="1.5"/><line x1="35" y1="25" x2="42" y2="33" stroke="#211A2E" stroke-width="1.5"/><line x1="125" y1="25" x2="118" y2="33" stroke="#211A2E" stroke-width="1.5"/><text x="8" y="82" font-size="10" fill="#211A2E">0</text><text x="12" y="34" font-size="10" fill="#211A2E">1/4</text><text x="68" y="10" font-size="10" fill="#211A2E">2/4</text><text x="122" y="34" font-size="10" fill="#211A2E">3/4</text><text x="142" y="82" font-size="10" fill="#211A2E">4/4</text></svg>`;

const CSS = `
  .box { border: 1.5px solid #211A2E; border-radius: 6px; margin: 6px 0; overflow: hidden; }
  .banner { background: #211A2E; color: #fff; font-weight: bold; text-align: center; padding: 3px 8px; font-size: 12px; letter-spacing: .5px; text-transform: uppercase; }
  .banner.dark { border-radius: 14px; margin: 6px; }
  .boxbody { padding: 6px 8px; }
  .frow { display: flex; gap: 6px; padding: 3px 0; align-items: baseline; }
  .flabel { white-space: nowrap; font-size: 11px; }
  .fvalue { flex: 1; border-bottom: 1px dotted #7A7090; min-height: 14px; font-weight: bold; color: #1D3FA8; font-size: 11px; }
  .boxtext { font-size: 8.5px; line-height: 1.35; text-align: justify; }
  .pair { display: flex; gap: 10px; align-items: stretch; }
  .pair > * { flex: 1; }
  .diagram { display: flex; align-items: center; gap: 10px; }
  .diagram-side { flex: 1; }
  .legend { white-space: pre-line; font-size: 11px; font-weight: bold; text-align: center; padding: 4px; }
  .gauge { text-align: center; }
  .gauge-title { font-size: 11px; font-weight: bold; }
  body { font-family: Helvetica, Arial, sans-serif; color: #211A2E; padding: 24px; font-size: 12px; line-height: 1.45; }
  .heading { margin: 16px 0 6px; padding-bottom: 3px; }
  .underlined { border-bottom: 1px solid #EAE5F2; }
  .boxed { border: 1px solid #211A2E; padding: 6px 8px; }
  .para { margin: 6px 0; }
  .list { margin: 6px 0; padding-inline-start: 20px; }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  td { padding: 3px 0; vertical-align: top; }
  .fields td.label { color: #81778F; width: 24%; padding-inline-end: 8px; }
  table.bordered td { border: 1px solid #C9C0D8; padding: 4px 6px; }
  .cols td { padding: 6px 8px; border-bottom: 1px solid #EAE5F2; font-size: 10px; }
  .cols.bordered td { border: 1px solid #C9C0D8; }
  .header td { width: 33%; font-size: 12px; }
  .logo { max-height: 64px; max-width: 140px; object-fit: contain; }
  hr { border: 0; border-top: 1px solid #C9C0D8; margin: 10px 0; }
  .signatures { margin-top: 26px; display: flex; justify-content: space-between; gap: 24px; page-break-inside: avoid; }
  .sign-box { flex: 1; border: 1px solid #EAE5F2; border-radius: 6px; padding: 8px; font-size: 11px; text-align: center; }
  .sign-title { font-weight: bold; }
  .sign-area { height: 76px; display: flex; align-items: center; justify-content: center; border-bottom: 1px solid #211A2E; margin: 6px 0 4px; }
  .stamp { height: 70px; max-width: 110px; object-fit: contain; margin-inline-start: 8px; }
  .sign-name { font-weight: bold; }
  .sign-date { color: #81778F; font-size: 10px; }
`;

const isHalf = (block: Block) => (block.type === 'box' || block.type === 'fuelGauge') && block.width === 'half';

export function renderTemplateHtml(template: ContractTemplate, input: RenderInput): string {
  const rtlDefault = template.direction === 'rtl';
  const visible = template.blocks.filter((block) => blockVisible(block, input.context));
  const parts: string[] = [];
  for (let i = 0; i < visible.length; i++) {
    const block = visible[i];
    if (isHalf(block) && visible[i + 1] && isHalf(visible[i + 1])) {
      parts.push(`<div class="pair">${renderBlock(block, input, rtlDefault)}${renderBlock(visible[i + 1], input, rtlDefault)}</div>`);
      i++;
    } else {
      parts.push(renderBlock(block, input, rtlDefault));
    }
  }
  return `<html><head><meta charset="utf-8" /><style>${CSS}</style></head><body dir="${rtlDefault ? 'rtl' : 'ltr'}">${parts.join('\n')}</body></html>`;
}

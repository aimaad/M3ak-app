import { ensureSignatures, LIMITS, type Block, type ContractTemplate, type FieldRow } from './template';

/**
 * Transforme la transcription d'un contrat (texte avec quelques conventions : « # Titre », « ## Article », « > en-tête »,
 * « - puce », « Libellé : {{champ}} », « [SIGNATURES: a | b] ») en modèle de contrat. Tout le texte est conservé ;
 * seule la mise en forme est décidée ici, localement, sans IA.
 */
const ARABIC = /[؀-ۿ]/g;
const LETTERS = /[A-Za-zÀ-ɏ؀-ۿ]/g;

export function isMostlyArabic(text: string): boolean {
  const letters = text.match(LETTERS)?.length ?? 0;
  return letters > 0 && (text.match(ARABIC)?.length ?? 0) / letters > 0.5;
}

const rtlStyle = (text: string) => (isMostlyArabic(text) ? { rtl: true as const, align: 'right' as const } : {});

/** Valeur d'un champ à remplir : champ automatique, points de suite, ou vide. */
const looksLikeFillIn = (value: string) => /\{\{[a-z_]+\}\}/.test(value) || /^[\s.…_\-–]*$/.test(value);

const SIGNATURE_LINE = /^\[\s*SIGNATURES?\s*:(.*)\]$/i;
const AGENCY_WORDS = /agence|loueur|bailleur|cachet|société|societe|وكالة|المكري|الطابع/i;

function signatureBlock(spec: string): Block {
  const labels = spec.split('|').map((part) => part.trim()).filter(Boolean).slice(0, 4);
  const list = labels.length > 0 ? labels : ['Le locataire', "Pour l'agence"];
  return { type: 'signatures', boxes: list.map((label, index) => ({ role: AGENCY_WORDS.test(label) || (labels.length === 2 && index === 1) ? 'agency' : 'client', label })) };
}

export function templateFromTranscription(raw: string): ContractTemplate | null {
  const lines = raw.replace(/\r/g, '').replace(/^```[a-z]*\n?|```$/gim, '').split('\n');
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { items: string[]; numbered: boolean } | null = null;
  let header: string[] = [];
  let fields: FieldRow[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      const text = paragraph.join('\n');
      blocks.push({ type: 'paragraph', text, ...rtlStyle(text) });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      const joined = list.items.join(' ');
      blocks.push({ type: 'list', items: list.items, ...(list.numbered ? { numbered: true } : {}), ...(isMostlyArabic(joined) ? { rtl: true } : {}) });
      list = null;
    }
  };
  const flushHeader = () => {
    if (header.length > 0) {
      blocks.push({ type: 'header', logo: 'left', center: header.join('\n') });
      header = [];
    }
  };
  const flushFields = () => {
    if (fields.length >= 2) blocks.push({ type: 'fields', columns: 1, rows: fields });
    else if (fields.length === 1) blocks.push({ type: 'paragraph', text: `${fields[0].label} : ${fields[0].value}` });
    fields = [];
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
    flushHeader();
    flushFields();
  };

  for (const original of lines) {
    const line = original.trim();
    if (line === '') {
      flushAll();
      continue;
    }

    const signature = SIGNATURE_LINE.exec(line);
    if (signature) {
      flushAll();
      blocks.push(signatureBlock(signature[1]));
      continue;
    }
    if (/^[-–—_=]{3,}$/.test(line)) {
      flushAll();
      blocks.push({ type: 'rule' });
      continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      flushAll();
      const level = heading[1].length;
      const text = heading[2].trim();
      blocks.push(
        level === 1
          ? { type: 'heading', text, size: 'xl', bold: true, align: 'center', border: 'none' }
          : level === 2
            ? { type: 'heading', text, size: 'md', bold: true, border: 'bottom', ...rtlStyle(text) }
            : { type: 'heading', text, size: 'sm', bold: true, border: 'none', ...rtlStyle(text) }
      );
      continue;
    }
    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      flushParagraph();
      flushList();
      flushFields();
      if (quote[1].trim()) header.push(quote[1].trim());
      continue;
    }
    const item = /^(?:([-•*])|(\d{1,2}[.)]))\s+(.+)$/.exec(line);
    if (item) {
      flushParagraph();
      flushFields();
      flushHeader();
      const numbered = !!item[2];
      if (list && list.numbered !== numbered) flushList();
      list = list ?? { items: [], numbered };
      list.items.push(item[3].trim());
      continue;
    }
    const field = /^([^:{}]{2,80}?)\s*[:：]\s*(.*)$/.exec(line);
    if (field && looksLikeFillIn(field[2])) {
      flushParagraph();
      flushList();
      flushHeader();
      fields.push({ label: field[1].trim(), value: field[2].trim() });
      continue;
    }

    flushList();
    flushHeader();
    flushFields();
    paragraph.push(line);
  }
  flushAll();

  if (blocks.length === 0) return null;
  const arabicBlocks = blocks.filter((block) => 'rtl' in block && block.rtl).length;
  const template: ContractTemplate = {
    v: 1,
    direction: arabicBlocks > blocks.length / 2 ? 'rtl' : 'ltr',
    blocks: blocks.slice(0, LIMITS.blocks),
  };
  return ensureSignatures(template);
}

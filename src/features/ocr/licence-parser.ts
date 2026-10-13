import type { LicenceOcrFields, OcrField } from '@/features/customers/licence-ocr';

import { extractLabeled, type LabelSpec } from './labeled';
import { cleanName, findDate, fixDigits } from './text';

type Key = 'nom' | 'prenom' | 'naissance' | 'delivrance' | 'expiration' | 'autorite' | 'numero' | 'categories';

/** Catégories de permis courantes au Maroc / en Europe (liste fermée : tout le reste est ignoré). */
const VALID_CATEGORIES = new Set(['AM', 'A1', 'A2', 'A', 'B1', 'B', 'BE', 'C1', 'C', 'C1E', 'CE', 'D1', 'D', 'D1E', 'DE', 'EB', 'EC', 'ED']);

const LABEL_END = String.raw`\s*[.):\-]?\s*`;

function readCategories(text: string): string | null {
  const tokens = text
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter((token) => VALID_CATEGORIES.has(token));
  return tokens.length > 0 ? [...new Set(tokens)].join(' ') : null;
}

function readNumber(text: string): string | null {
  const value = text.replace(/[^A-Za-z0-9/\- ]/g, '').replace(/\s+/g, ' ').trim();
  return value.length >= 4 && value.length <= 20 && /\d{3}/.test(value) ? value : null;
}

const SPECS: LabelSpec<Key>[] = [
  { key: 'prenom', labels: [new RegExp(String.raw`^(?:2${LABEL_END}|PRENOMS?\b${LABEL_END}|2\s+PRENOMS?\b${LABEL_END})`)], accept: (t) => cleanName(t) },
  { key: 'nom', labels: [new RegExp(String.raw`^(?:1${LABEL_END}|NOM\b${LABEL_END}|1\s+NOM\b${LABEL_END})`)], accept: (t) => cleanName(t) },
  {
    key: 'naissance',
    labels: [new RegExp(String.raw`^(?:3${LABEL_END}|DATE\s+(?:ET\s+LIEU\s+)?DE\s+NAISSANCE\b${LABEL_END}|NE\(?E?\)?\s+LE\b${LABEL_END})`)],
    accept: findDate,
  },
  { key: 'delivrance', labels: [new RegExp(String.raw`^(?:4\s*A${LABEL_END}|DATE\s+DE\s+DELIVRANCE\b${LABEL_END}|DELIVRE\s+LE\b${LABEL_END})`)], accept: findDate },
  {
    key: 'expiration',
    labels: [new RegExp(String.raw`^(?:4\s*B${LABEL_END}|DATE\s+D'?\s*EXPIRATION\b${LABEL_END}|(?:VALABLE|VALIDE)\s+JUSQU'?\s*(?:AU|A)\b${LABEL_END}|EXPIRE\s+LE\b${LABEL_END})`)],
    accept: findDate,
  },
  { key: 'autorite', labels: [new RegExp(String.raw`^(?:4\s*C${LABEL_END}|AUTORITE\b${LABEL_END})`)], accept: (t) => cleanName(t, 80) },
  {
    key: 'numero',
    labels: [new RegExp(String.raw`^(?:5${LABEL_END}|N\s*[°O0]\s*(?:DU\s+)?PERMIS\b${LABEL_END}|NUMERO\s+(?:DU\s+)?PERMIS\b${LABEL_END}|PERMIS\s+N\s*[°O0]?${LABEL_END})`)],
    accept: readNumber,
  },
  { key: 'categories', labels: [new RegExp(String.raw`^(?:9${LABEL_END}|CATEGORIES?\b${LABEL_END})`)], accept: readCategories },
];

/** Une même ligne peut contenir plusieurs champs (« 4a 01.06.2020 4b 01.06.2030 ») : on la coupe. */
function splitInlineMarkers(lines: string[]): string[] {
  return lines.flatMap((line) => line.split(/\s+(?=4\s*[abcABC]\s*[.):]\s)/));
}

const EMPTY: OcrField<never> = { value: null, confidence: 'low' };

/**
 * Lit le texte OCR d'un permis. Un champ non trouvé reste null : jamais deviné.
 * Confiance « high » réservée aux dates et catégories ancrées sur leur étiquette et valides ;
 * noms et numéros restent « medium » (l'OCR confond facilement des lettres) donc à vérifier.
 */
export function parseLicenceText(lines: string[]): LicenceOcrFields {
  const found = extractLabeled(splitInlineMarkers(lines), SPECS);

  const text = (key: Key): OcrField<string> => {
    const hit = found[key];
    return hit ? { value: hit.value, confidence: 'medium' } : { ...EMPTY };
  };
  const date = (key: Key): OcrField<string> => {
    const hit = found[key];
    return hit ? { value: hit.value, confidence: 'high' } : { ...EMPTY };
  };

  // Repli : un numéro de permis marocain « 12/345678 » isolé sur une ligne.
  let numero = text('numero');
  if (numero.value === null) {
    for (const line of lines) {
      const match = /^\s*(\d{1,2}\s?\/\s?\d{5,8})\s*$/.exec(fixDigits(line).replace(/\s+/g, ' '));
      if (match) {
        numero = { value: match[1].replace(/\s/g, ''), confidence: 'medium' };
        break;
      }
    }
  }

  const categoriesRaw = found.categories?.value;
  return {
    nom: text('nom'),
    prenom: text('prenom'),
    numeroPermis: numero,
    dateDelivrance: date('delivrance'),
    dateExpiration: date('expiration'),
    categories: categoriesRaw ? { value: categoriesRaw.split(' '), confidence: 'high' } : { ...EMPTY },
    dateNaissance: date('naissance'),
    autorite: text('autorite'),
  };
}

/**
 * Outils de lecture du texte brut renvoyé par l'OCR LOCAL (sur l'appareil).
 * Fonctions pures : aucune écriture dans les journaux, aucun accès réseau.
 */

/** Minuscules → majuscules sans accents, en gardant EXACTEMENT la même longueur (indices alignés). */
export function foldKeepLength(text: string): string {
  let out = '';
  for (const ch of text) {
    const base = ch.normalize('NFD')[0] ?? ch;
    out += base.toUpperCase().length === 1 ? base.toUpperCase() : base;
  }
  return out;
}

const HAS_LATIN_OR_DIGIT = /[A-Za-z0-9]/;
const ARABIC = /[؀-ۿ]/;

/** Découpe les blocs en lignes, retire les vides et les lignes sans aucun caractère exploitable. */
export function toLines(blocks: string[]): string[] {
  const lines: string[] = [];
  for (const block of blocks) {
    for (const raw of block.split(/\r?\n/)) {
      const line = raw.replace(/\s+/g, ' ').trim();
      if (line && (HAS_LATIN_OR_DIGIT.test(line) || ARABIC.test(line))) lines.push(line);
    }
  }
  return lines;
}

/** Corrige les confusions classiques de l'OCR dans un contexte purement numérique (O→0, l/I→1). */
export function fixDigits(text: string): string {
  return text.replace(/[Oo]/g, '0').replace(/[lI|]/g, '1');
}

const DATE_RE = /(\d{1,2})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{4})/;

/** Première date JJ.MM.AAAA / JJ/MM/AAAA / JJ-MM-AAAA trouvée dans le texte, en ISO, ou null si invalide. */
export function findDate(text: string): string | null {
  // On ne corrige O→0 / l→1 que dans les portions qui ressemblent à une date.
  const candidate = /[0-9OolI|]{1,2}\s*[./-]\s*[0-9OolI|]{1,2}\s*[./-]\s*[0-9OolI|]{4}/.exec(text)?.[0];
  if (!candidate) return null;
  const match = DATE_RE.exec(fixDigits(candidate));
  if (!match) return null;
  const iso = `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso) return null;
  const year = Number(match[3]);
  return year >= 1900 && year <= 2100 ? iso : null;
}

/** Texte de nom propre (nom, prénom, marque…) : lettres, espaces, apostrophes, tirets. */
export function cleanName(text: string, max = 60): string | null {
  if (/\d/.test(text)) return null; // un nom ne contient pas de chiffres : plus probablement une autre ligne
  const value = text
    .replace(/[^\p{L}\s'’-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (value.length < 2 || value.length > max) return null;
  return /\p{L}/u.test(value) ? value : null;
}

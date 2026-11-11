/**
 * Plaques et VIN du parcours « Ajouter un véhicule » et de l'outil « Vérifier une plaque ».
 *
 * Trois formes de plaque : marocaine « 68013 | ب | 72 », provisoire « WW 482190 », autre (texte tel quel).
 * `formatPlate` donne LA forme enregistrée (une seule écriture possible pour une même plaque) ; `plateKey` sert à comparer :
 * sans espaces, barres, tirets, marques invisibles, ni allongement de lettre (« هـ » = « ه »), en majuscules. Pour toute plaque `p`,
 * `plateKey(formatPlate(p)) === plateKey(p)` : la forme enregistrée ne change jamais le résultat d'une comparaison.
 */

/** Lettres arabes des plaques marocaines, proposées dans le sélecteur (« هـ » est affiché avec son allongement). */
export const PLATE_LETTERS = ['أ', 'ب', 'ج', 'د', 'ه', 'و', 'ز', 'ح', 'ط', 'ك', 'ل', 'م', 'ن', 'ق', 'ر', 'ص', 'ع', 'ف', 'ت', 'ي', 'ش'] as const;

/** Marques invisibles de sens d'écriture et allongement (tatweel) : ils brouillent les comparaisons. */
const INVISIBLE = /[‎‏؜‪-‮⁦-⁩ـ]/g;
/** Variantes du « ه » et du « أ » qu'on rapproche pour comparer (copier-coller, claviers différents). */
const LETTER_VARIANTS: [RegExp, string][] = [
  [/[إآٱ]/g, 'أ'],
  [/[ةە]/g, 'ه'],
];

function cleaned(raw: string): string {
  let text = raw.replace(INVISIBLE, '');
  for (const [pattern, replacement] of LETTER_VARIANTS) text = text.replace(pattern, replacement);
  return text;
}

const MOROCCAN = /^\s*(\d{1,6})\s*[-|/._\s]\s*([؀-ۿ])\s*[-|/._\s]\s*(\d{1,2})\s*$/u;
const WW = /^\s*WW[\s\-._]*(\d{1,8})\s*$/iu;

export type PlateKind = 'moroccan' | 'ww' | 'other';

export function plateKind(raw: string): PlateKind {
  const text = cleaned(raw);
  return MOROCCAN.test(text) ? 'moroccan' : WW.test(text) ? 'ww' : 'other';
}

/** Forme enregistrée : « 68013-ب-72 » → « 68013 | ب | 72 » ; « ww 482190 » → « WW 482190 » ; autre : nettoyée et en majuscules. */
export function formatPlate(raw: string): string {
  const text = cleaned(raw);
  const moroccan = MOROCCAN.exec(text);
  if (moroccan) return `${moroccan[1]} | ${moroccan[2]} | ${moroccan[3]}`;
  const ww = WW.exec(text);
  if (ww) return `WW ${ww[1]}`;
  return text.trim().replace(/\s+/g, ' ').toUpperCase();
}

/** Clé de comparaison d'une plaque (voir plus haut). */
export function plateKey(raw: string): string {
  return cleaned(raw).replace(/[\s|/\-._]+/g, '').toUpperCase();
}

/** Clé de comparaison d'un VIN : sans espaces ni tirets, en majuscules. */
export function vinKey(raw: string): string {
  return raw.replace(/[\s\-_.]+/g, '').toUpperCase();
}

/** Un VIN valide : 17 caractères, chiffres et lettres, sans I, O ni Q. */
export const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;
export const isValidVin = (raw: string): boolean => VIN_PATTERN.test(vinKey(raw));

/** Cherche un VIN valide dans un texte lu (un code-barres porte parfois un préfixe : « I1HGCM82633A004352 »). */
export function extractVin(raw: string): string | null {
  const key = vinKey(raw);
  for (let start = 0; start + 17 <= key.length; start += 1) {
    const candidate = key.slice(start, start + 17);
    if (VIN_PATTERN.test(candidate)) return candidate;
  }
  return null;
}

export type PlateParts = { number: string; letter: string; region: string };

/** Les 3 parties d'une plaque marocaine (saisie en forme de plaque) ; vides si la plaque n'est pas de ce format. */
export function splitPlate(raw: string): PlateParts {
  const match = MOROCCAN.exec(cleaned(raw));
  return match ? { number: match[1], letter: match[2], region: match[3] } : { number: '', letter: '', region: '' };
}

/** Plaque marocaine complète (numéro, lettre et région renseignés) → forme enregistrée ; sinon chaîne vide. */
export function joinPlate(parts: PlateParts): string {
  const number = parts.number.replace(/\D/g, '');
  const region = parts.region.replace(/\D/g, '');
  return number && parts.letter && region ? formatPlate(`${number} | ${parts.letter} | ${region}`) : '';
}

/** « WW 482190 » à partir des seuls chiffres saisis ; vide sans chiffre. */
export const joinWw = (digits: string): string => {
  const clean = digits.replace(/\D/g, '');
  return clean ? `WW ${clean}` : '';
};

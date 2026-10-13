import { foldKeepLength } from './text';

/**
 * Association « étiquette → valeur » pour les documents à champs étiquetés.
 *
 * Le texte d'un document arrive soit « étiquette + valeur sur la même ligne », soit « étiquette
 * puis valeur sur la ligne suivante », soit « plusieurs étiquettes puis plusieurs valeurs » (mise en
 * page en colonnes). Les trois cas sont gérés par une file d'attente d'étiquettes en attente.
 */
export type LabelSpec<K extends string> = {
  key: K;
  /** Appliqué au texte normalisé (majuscules sans accents) ; la valeur « en ligne » suit la correspondance. */
  labels: RegExp[];
  /** Retourne la valeur nettoyée, ou null si le texte n'est pas une valeur plausible pour ce champ. */
  accept: (text: string) => string | null;
};

export type LabeledResult<K extends string> = Partial<Record<K, { value: string; inline: boolean }>>;

function detectLabel<K extends string>(
  folded: string,
  specs: LabelSpec<K>[]
): { spec: LabelSpec<K>; rest: number } | null {
  for (const spec of specs) {
    for (const re of spec.labels) {
      const match = re.exec(folded);
      if (match && match.index === 0) return { spec, rest: match[0].length };
    }
  }
  return null;
}

/**
 * Mise en page en colonnes : une même ligne peut contenir plusieurs étiquettes
 * (« Numéro d'immatriculation Première mise en circulation »). On la coupe à chaque étiquette.
 */
function splitAtLabels<K extends string>(line: string, specs: LabelSpec<K>[]): { spec: LabelSpec<K> | null; text: string }[] {
  const folded = foldKeepLength(line);
  const hits: { index: number; end: number; spec: LabelSpec<K> }[] = [];
  for (const spec of specs) {
    for (const re of spec.labels) {
      const loose = new RegExp(`(?<![A-Z0-9])(?:${re.source.replace(/^\^/, '')})`, 'g');
      for (const match of folded.matchAll(loose)) {
        hits.push({ index: match.index, end: match.index + match[0].length, spec });
      }
    }
  }
  // Une étiquette plus longue ou plus tôt l'emporte sur celles qu'elle recouvre (« TYPE / MODELE » vs « MODELE »).
  hits.sort((a, b) => a.index - b.index || b.end - a.end);
  const kept: typeof hits = [];
  for (const hit of hits) {
    if (kept.length === 0 || hit.index >= kept[kept.length - 1].end) kept.push(hit);
  }
  if (kept.length === 0) return [{ spec: null, text: line }];

  const segments: { spec: LabelSpec<K> | null; text: string }[] = [];
  if (kept[0].index > 0) segments.push({ spec: null, text: line.slice(0, kept[0].index).trim() });
  kept.forEach((hit, i) => {
    const next = kept[i + 1]?.index ?? line.length;
    segments.push({ spec: hit.spec, text: line.slice(hit.end, next).replace(/^[\s:.\-–—/|]+/, '').trim() });
  });
  return segments.filter((segment) => segment.spec !== null || segment.text !== '');
}

export function extractLabeled<K extends string>(
  lines: string[],
  specs: LabelSpec<K>[],
  options: { splitAtLabels?: boolean } = {}
): LabeledResult<K> {
  const result: LabeledResult<K> = {};
  const pending: LabelSpec<K>[] = [];

  const fill = (spec: LabelSpec<K>, text: string, inline: boolean): boolean => {
    if (result[spec.key]) return true;
    const value = spec.accept(text);
    if (value === null) return false;
    result[spec.key] = { value, inline };
    return true;
  };

  const consume = (spec: LabelSpec<K> | null, text: string, labelKnown: boolean) => {
    if (labelKnown && spec) {
      if (text && fill(spec, text, true)) return;
      if (!result[spec.key]) pending.push(spec);
      return;
    }
    // Ligne de valeur : la première étiquette en attente qui l'accepte la prend.
    for (let i = 0; i < pending.length; i++) {
      if (result[pending[i].key]) {
        pending.splice(i, 1);
        i--;
        continue;
      }
      if (fill(pending[i], text, false)) {
        pending.splice(i, 1);
        break;
      }
    }
  };

  for (const line of lines) {
    if (options.splitAtLabels) {
      for (const segment of splitAtLabels(line, specs)) consume(segment.spec, segment.text, segment.spec !== null);
      continue;
    }
    const folded = foldKeepLength(line);
    const found = detectLabel(folded, specs);
    if (found) {
      consume(found.spec, line.slice(found.rest).replace(/^[\s:.\-–—/|]+/, ''), true);
    } else {
      consume(null, line, false);
    }
  }
  return result;
}

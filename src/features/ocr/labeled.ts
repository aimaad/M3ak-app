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

export function extractLabeled<K extends string>(lines: string[], specs: LabelSpec<K>[]): LabeledResult<K> {
  const result: LabeledResult<K> = {};
  const pending: LabelSpec<K>[] = [];

  const fill = (spec: LabelSpec<K>, text: string, inline: boolean): boolean => {
    if (result[spec.key]) return true;
    const value = spec.accept(text);
    if (value === null) return false;
    result[spec.key] = { value, inline };
    return true;
  };

  for (const line of lines) {
    const folded = foldKeepLength(line);
    const found = detectLabel(folded, specs);

    if (found) {
      const inlineText = line.slice(found.rest).replace(/^[\s:.\-–—/|]+/, '');
      if (inlineText && fill(found.spec, inlineText, true)) continue;
      if (!result[found.spec.key]) pending.push(found.spec);
      continue;
    }

    // Ligne de valeur : la première étiquette en attente qui l'accepte la prend.
    for (let i = 0; i < pending.length; i++) {
      if (result[pending[i].key]) {
        pending.splice(i, 1);
        i--;
        continue;
      }
      if (fill(pending[i], line, false)) {
        pending.splice(i, 1);
        break;
      }
    }
  }
  return result;
}

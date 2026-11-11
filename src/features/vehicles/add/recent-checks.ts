import { plateKey, vinKey } from './plate';

export type RecentCheck = { query: string; kind: 'plate' | 'ww' | 'vin'; found: boolean; at: number };

export const RECENT_CHECKS_MAX = 5;

const sameQuery = (a: RecentCheck, b: RecentCheck) => (a.kind === 'vin' ? vinKey(a.query) === vinKey(b.query) : plateKey(a.query) === plateKey(b.query));

/** Ajoute une vérification en tête ; la même plaque ou le même VIN n'apparaît qu'une fois ; on garde les 5 dernières. */
export function pushRecentCheck(list: RecentCheck[], check: RecentCheck): RecentCheck[] {
  return [check, ...list.filter((entry) => !sameQuery(entry, check))].slice(0, RECENT_CHECKS_MAX);
}

/** Lecture sûre de la mémoire du téléphone : toute valeur abîmée donne une liste vide. */
export function parseRecentChecks(raw: string | null | undefined): RecentCheck[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) return [];
    return value
      .filter((entry): entry is RecentCheck => typeof entry === 'object' && entry !== null && typeof entry.query === 'string' && ['plate', 'ww', 'vin'].includes(entry.kind) && typeof entry.found === 'boolean' && typeof entry.at === 'number')
      .slice(0, RECENT_CHECKS_MAX);
  } catch {
    return [];
  }
}

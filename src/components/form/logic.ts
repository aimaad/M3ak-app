/** Logique pure du kit de formulaire (testée) : nombres, prix suggérés, dates relatives, couleurs, contrôle d'une photo. */

export const digitsOnly = (text: string) => text.replace(/\D/g, '');

/** « 45200 » → « 45 200 » (espace insécable fine, comme le reste de l'app). */
export function formatThousands(digits: string): string {
  const clean = digitsOnly(digits).replace(/^0+(?=\d)/, '');
  return clean.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export const round50 = (value: number) => Math.round(value / 50) * 50;

export const WEEK_DISCOUNT = 15;
export const MONTH_DISCOUNT = 30;

/**
 * Prix semaine et mois proposés à partir du prix du jour : 7 jours −15 %, 30 jours −30 %, arrondis à 50. Une suggestion : rien n'est
 * enregistré tant que l'utilisateur ne la touche pas. 500/jour → semaine 3 000, mois 10 500. Null sans prix du jour valable.
 */
export function suggestWeekMonth(dayPrice: number | null): { week: number; month: number; weekPct: number; monthPct: number } | null {
  if (!dayPrice || !Number.isFinite(dayPrice) || dayPrice <= 0) return null;
  return { week: round50(dayPrice * 7 * (1 - WEEK_DISCOUNT / 100)), month: round50(dayPrice * 30 * (1 - MONTH_DISCOUNT / 100)), weekPct: WEEK_DISCOUNT, monthPct: MONTH_DISCOUNT };
}

// ------------------------------------------------------------------ dates

const MS_PER_DAY = 86_400_000;
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
export const parseIsoDay = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
};
export const toIsoDay = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export type Relative = { key: 'today' | 'tomorrow' | 'yesterday' | 'inDays' | 'inMonthOne' | 'inMonths' | 'agoDays' | 'agoMonthOne' | 'agoMonths'; n?: number };

/** Rappel relatif d'un jour : « aujourd'hui », « dans 3 jours », « dans 12 mois », « il y a 2 mois » (un mois = 30 jours, arrondi). */
export function relativeDay(iso: string, now: Date): Relative {
  const diff = Math.round((parseIsoDay(iso).getTime() - startOfDay(now).getTime()) / MS_PER_DAY);
  if (diff === 0) return { key: 'today' };
  if (diff === 1) return { key: 'tomorrow' };
  if (diff === -1) return { key: 'yesterday' };
  if (diff > 0) {
    if (diff < 30) return { key: 'inDays', n: diff };
    const months = Math.round(diff / 30);
    return months === 1 ? { key: 'inMonthOne' } : { key: 'inMonths', n: months };
  }
  const past = -diff;
  if (past < 30) return { key: 'agoDays', n: past };
  const months = Math.round(past / 30);
  return months === 1 ? { key: 'agoMonthOne' } : { key: 'agoMonths', n: months };
}

// ------------------------------------------------------------------ couleurs

export const SWATCH_KEYS = ['blanc', 'noir', 'gris', 'argent', 'rouge', 'bleu', 'beige'] as const;
export type SwatchKey = (typeof SWATCH_KEYS)[number];

const strip = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/** « BLANC », « blanc  », « Blanc » → pastille Blanc ; vide → rien ; valeur inconnue → « autre » (affichée telle quelle). */
export function colorKey(raw: string | null | undefined): SwatchKey | 'other' | null {
  const value = strip(raw ?? '');
  if (!value) return null;
  return (SWATCH_KEYS as readonly string[]).includes(value) ? (value as SwatchKey) : 'other';
}

// ------------------------------------------------------------------ photos

export const MIN_PHOTO_SIDE = 1000;
export const MIN_PHOTO_BYTES = 30 * 1024;

/** Contrôle côté téléphone avant l'envoi : côté le plus long < 1000 px ou fichier < 30 Ko → « Photo trop petite ». (Flou, sombre : voir docs.) */
export function photoProblem(info: { width: number; height: number; bytes: number }): 'too_small' | null {
  return Math.max(info.width, info.height) < MIN_PHOTO_SIDE || info.bytes < MIN_PHOTO_BYTES ? 'too_small' : null;
}

/** Part d'avancement « 1 sur 6 » : nombre de cases remplies. */
export const filledCount = (items: { uri: string | null }[]) => items.filter((item) => item.uri).length;

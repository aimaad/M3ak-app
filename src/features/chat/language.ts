export type MessageLanguage = 'fr' | 'ar' | 'darija-latin';

/** Mots très typiques de la darija écrite en lettres latines (« arabizi »), absents du français courant. */
const DARIJA_WORDS = new Set([
  'chnohoma', 'chnou', 'chno', 'chkoun', 'shkoun', 'tomobil', 'tomobilat', 'tonobil', 'kayn', 'kayna', 'kaynin', 'kaynch', 'dyal', 'dial', 'diyal',
  'ghadi', 'lyoum', 'lioum', 'ghda', 'ghedda', 'simana', 'semana', 'wach', 'bghit', 'bghiti', 'chhal', 'mzyan', 'mzian', 'bzaf', 'rje3', 'rj3',
  'ykouno', 'aykono', 'aykouno', 'hadchi', 'daba', 'safi', 'khlas', 'flous', 'kra', 'kri', 'lbare7', 'mnin', 'fin', 'hna', 'dyalo', 'dyalha',
]);
const NOT_DISTINCTIVE = new Set(['fin', 'safi', 'hna', 'daba']);

const ARABIC_LETTER = /[؀-ۿݐ-ݿ]/g;
const LATIN_LETTER = /[A-Za-zÀ-ÿ]/g;

/**
 * Langue d'un texte : arabe (lettres arabes, y compris la darija écrite en arabe), darija en lettres latines, ou français.
 * Sert à choisir si « Écouter » est proposé (pas pour la darija latine, mal lue par la voix du téléphone) et le sous-titre.
 */
export function detectMessageLanguage(text: string): MessageLanguage {
  const arabic = (text.match(ARABIC_LETTER) ?? []).length;
  const latin = (text.match(LATIN_LETTER) ?? []).length;
  if (arabic > 0 && arabic >= latin) return 'ar';
  const words = text.toLowerCase().split(/[^a-z0-9àâçéèêëîïôûùüÿœ']+/).filter(Boolean);
  const strong = new Set(words.filter((w) => DARIJA_WORDS.has(w) && !NOT_DISTINCTIVE.has(w)));
  // Chiffres collés aux lettres (3la, rje3, 7ed, 9bel…) : écriture arabizi, quasi inexistante en français.
  const arabizi = words.some((w) => /^(?=.*[a-z])(?=.*[2379])[a-z2379]+$/.test(w) && /[a-z][2379]|[2379][a-z]/.test(w));
  return strong.size >= 2 || (strong.size >= 1 && arabizi) ? 'darija-latin' : 'fr';
}

/** « Écouter » est proposé pour le français et l'arabe, pas pour la darija en lettres latines. */
export function canListen(language: MessageLanguage): boolean {
  return language !== 'darija-latin';
}

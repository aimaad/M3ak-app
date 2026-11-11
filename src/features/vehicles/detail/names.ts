/**
 * Affichage de la marque et du modèle : « DACIA LOGAN » → « Dacia Logan », sans modifier la donnée.
 * Les sigles courts (3 lettres ou moins, en majuscules : BMW, DS, MG, VW) et les mots qui contiennent un chiffre (C3, i20, 308) restent tels quels ;
 * un mot déjà en casse mixte (« Sandero », « T-Roc », « iPace ») n'est jamais touché.
 */
const EXCEPTIONS: Record<string, string> = { KIA: 'Kia' };

function normalizeWord(word: string): string {
  if (!/\p{L}/u.test(word) || /\d/.test(word)) return word;
  if (word !== word.toLocaleUpperCase()) return word; // déjà en casse mixte ou en minuscules : on n'y touche pas
  if (EXCEPTIONS[word]) return EXCEPTIONS[word];
  if (Array.from(word).length <= 3) return word; // sigle court
  const [first, ...rest] = Array.from(word);
  return first + rest.join('').toLocaleLowerCase();
}

/** Casse d'affichage d'un texte de marque ou de modèle (chaque mot, y compris après un tiret). */
export function displayCase(text: string): string {
  return text
    .trim()
    .split(/(\s+|-)/)
    .map((part) => (/^(\s+|-)$/.test(part) ? part : normalizeWord(part)))
    .join('');
}

/** « Dacia Logan » : nom affiché d'un véhicule. */
export function displayName(vehicle: { marque: string; modele: string }): string {
  return `${displayCase(vehicle.marque)} ${displayCase(vehicle.modele)}`.trim();
}

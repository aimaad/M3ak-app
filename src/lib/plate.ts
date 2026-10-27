const LRM = '‎';

/**
 * Plaque marocaine « 8921-أ-14 » : mélanger chiffres et lettre arabe fait afficher l'ordre à l'envers (« 8921-14-أ »).
 * On entoure la lettre arabe d'un marqueur de direction invisible (gauche→droite) pour garder l'ordre voulu, où que la
 * plaque apparaisse dans un texte. Sans plaque dans le texte, rien ne change.
 */
const PLATE = /(\d{1,6}\s*[-|/]?\s*)([؀-ۿݐ-ݿ])(\s*[-|/]?\s*\d{1,2})/g;

export function fixPlateDirection(text: string): string {
  return text.replace(PLATE, (_all, before: string, letter: string, after: string) => `${before}${LRM}${letter}${LRM}${after}`);
}

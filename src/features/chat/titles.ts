const MAX_TITLE = 48;

/**
 * Titre court d'une conversation, tiré de la première question et dans sa langue : espaces nettoyés, première phrase, première
 * lettre en majuscule, coupé à un mot entier avec « … ». Sans texte : chaîne vide (l'écran affiche alors « Conversation »).
 */
export function makeTitle(question: string): string {
  const clean = question.replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const firstSentence = (clean.split(/(?<=[.!?؟])\s+/)[0] ?? clean).replace(/[.!?؟\s]+$/, '') || clean;
  const first = firstSentence.charAt(0).toLocaleUpperCase() + firstSentence.slice(1);
  if (first.length <= MAX_TITLE) return first;
  const cut = first.slice(0, MAX_TITLE);
  const space = cut.lastIndexOf(' ');
  return `${(space > 20 ? cut.slice(0, space) : cut).replace(/[\s,;:.]+$/, '')}…`;
}

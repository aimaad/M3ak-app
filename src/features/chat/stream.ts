/** Longueur minimale d'un morceau lu à voix haute : évite d'appeler la voix pour « Oui. » puis pour chaque mot. */
const MIN_CHUNK = 24;

/**
 * Phrases terminées du texte reçu pendant le flux, à partir de l'endroit déjà lu (`from`). Une phrase finit par . ! ? ؟ … ou un
 * saut de ligne suivi d'un espace (jamais au milieu d'un nombre comme « 12.5 »). Les phrases trop courtes sont regroupées avec la
 * suivante. `final` : le texte est complet, on rend aussi la fin. `next` : où reprendre la prochaine fois.
 */
export function takeSentences(text: string, from: number, final = false): { sentences: string[]; next: number } {
  const sentences: string[] = [];
  let next = from;
  const boundary = final ? /[.!?؟…\n]+(?=\s|$)/g : /[.!?؟…\n]+(?=\s)/g;
  boundary.lastIndex = from;
  for (let match = boundary.exec(text); match; match = boundary.exec(text)) {
    const end = match.index + match[0].length;
    const piece = text.slice(next, end).trim();
    if (piece.length >= MIN_CHUNK) {
      sentences.push(piece);
      next = end;
    }
  }
  if (final) {
    const rest = text.slice(next).trim();
    if (rest) sentences.push(rest);
    next = text.length;
  }
  return { sentences, next };
}

/** Découpe un texte complet en morceaux de lecture (phrases regroupées, `max` caractères au plus) : peu d'appels à la voix. */
export function chunkForSpeech(text: string, max = 600): string[] {
  const { sentences } = takeSentences(text, 0, true);
  const chunks: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    if (current && current.length + sentence.length + 1 > max) {
      chunks.push(current);
      current = '';
    }
    current = current ? `${current} ${sentence}` : sentence;
    while (current.length > max) {
      chunks.push(current.slice(0, max));
      current = current.slice(max);
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

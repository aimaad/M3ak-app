/** Texte à lire : sans mise en forme ni liens. */
export function speakableText(text: string): string {
  return text.replace(/\*\*/g, '').replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim();
}

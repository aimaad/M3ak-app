import { toLines } from './text';

/**
 * OCR exécuté SUR L'APPAREIL (Google ML Kit sur Android, Apple Vision sur iOS, via expo-text-extractor).
 * Ce module ne fait aucun appel réseau applicatif, n'envoie l'image à aucun service et n'écrit
 * jamais le texte lu dans les journaux.
 *
 * Module natif : indisponible dans Expo Go, sur le web ou si le service ML Kit de l'appareil n'est
 * pas prêt. Dans ces cas on renvoie une erreur claire et l'écran propose la saisie manuelle —
 * jamais un envoi automatique vers un service externe.
 */
export type LocalOcrResult = { ok: true; lines: string[] } | { ok: false; error: 'ocr_unavailable' | 'ocr_failed' };

type TextExtractor = {
  isSupported: boolean;
  extractTextFromImage: (uri: string) => Promise<string[]>;
};

function loadExtractor(): TextExtractor | null {
  try {
    // Chargé à la demande : le require échoue (sans planter l'app) quand le module natif est absent.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module = require('expo-text-extractor') as TextExtractor;
    return module.isSupported ? module : null;
  } catch {
    return null;
  }
}

export function isLocalOcrAvailable(): boolean {
  return loadExtractor() !== null;
}

export async function recognizeLines(localUri: string): Promise<LocalOcrResult> {
  const extractor = loadExtractor();
  if (!extractor) return { ok: false, error: 'ocr_unavailable' };
  try {
    const blocks = await extractor.extractTextFromImage(localUri);
    return { ok: true, lines: toLines(blocks) };
  } catch {
    // Message volontairement muet : l'erreur native peut citer un chemin de fichier.
    return { ok: false, error: 'ocr_failed' };
  }
}

import { newId } from './uuid';

/** Durée maximale d'un message vocal : 2 minutes. */
export const MAX_RECORD_MS = 120_000;
/** En dessous de cette durée, l'enregistrement est considéré comme un appui accidentel. */
export const MIN_RECORD_MS = 700;
export const WAVE_BARS = 30;

/** Niveau du micro (dB, de -160 à 0) ramené entre 0 (silence) et 1 (fort). */
export function meteringToLevel(db: number | undefined | null): number {
  if (typeof db !== 'number' || !Number.isFinite(db)) return 0;
  return Math.max(0, Math.min(1, (db + 55) / 55));
}

/** Ajoute un niveau à la forme d'onde en gardant les `size` derniers. */
export function pushLevel(history: number[], level: number, size = WAVE_BARS): number[] {
  const next = [...history, Math.max(0, Math.min(1, level))];
  return next.length > size ? next.slice(next.length - size) : next;
}

/** « 0:07 », « 1:25 ». */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Forme d'onde d'une bulle vocale : hauteurs (6 à 28 px) stables pour un même message. */
export function voiceBars(seed: string, count = 24): number[] {
  let state = 0;
  for (let i = 0; i < seed.length; i++) state = (state * 31 + seed.charCodeAt(i)) >>> 0;
  return Array.from({ length: count }, () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return 6 + Math.round((state / 0xffffffff) * 22);
  });
}

export function audioContentType(uri: string): string {
  return /\.wav$/i.test(uri) ? 'audio/wav' : /\.m4a$/i.test(uri) ? 'audio/mp4' : 'audio/aac';
}

export function audioExtension(uri: string): 'wav' | 'aac' | 'm4a' {
  return /\.wav$/i.test(uri) ? 'wav' : /\.m4a$/i.test(uri) ? 'm4a' : 'aac';
}

/** Chemin dans le stockage privé : « <utilisateur>/<conversation>/<fichier>.<ext> » (le dossier de l'utilisateur seul y a accès). */
export function voicePath(userId: string, conversationId: string, extension: 'wav' | 'aac' | 'm4a'): string {
  return `${userId}/${conversationId}/${newId()}.${extension}`;
}

/** Part déjà lue d'un message vocal (0 à 1). */
export function playedFraction(currentSeconds: number, totalMs: number): number {
  return totalMs > 0 ? Math.max(0, Math.min(1, (currentSeconds * 1000) / totalMs)) : 0;
}

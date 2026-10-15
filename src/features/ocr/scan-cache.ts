/**
 * Cache des lectures de documents, SUR L'APPAREIL uniquement : relire la même photo ne refait pas d'envoi à Gemini
 * (moins d'attente, aucun quota ni coût consommé, aucune nouvelle transmission de la photo).
 *
 * Confidentialité : le résultat contient des données personnelles (noms, numéro de permis…). Il n'est donc gardé
 * que 24 h, limité à 20 entrées, lié à l'entreprise, et effacé à la déconnexion. Rien n'est envoyé au serveur.
 */
export type KeyValueStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

const STORAGE_KEY = 'm3ak.ocr-cache.v1';
export const SCAN_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const SCAN_CACHE_MAX_ENTRIES = 20;

type Entry = { at: number; fields: unknown };
type CacheMap = Record<string, Entry>;

export function scanCacheKey(agencyId: string, documentType: string, fileHash: string): string {
  return `${agencyId}:${documentType}:${fileHash}`;
}

async function load(storage: KeyValueStorage, now: number): Promise<CacheMap> {
  try {
    const raw = await storage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    const fresh: CacheMap = {};
    for (const [key, entry] of Object.entries(parsed as Record<string, unknown>)) {
      const at = (entry as Entry | null)?.at;
      if (typeof at === 'number' && now - at < SCAN_CACHE_TTL_MS && now >= at - 60_000) {
        fresh[key] = { at, fields: (entry as Entry).fields };
      }
    }
    return fresh;
  } catch {
    return {};
  }
}

export async function readScanCache(storage: KeyValueStorage, key: string, now = Date.now()): Promise<unknown | null> {
  const map = await load(storage, now);
  return map[key]?.fields ?? null;
}

export async function writeScanCache(storage: KeyValueStorage, key: string, fields: unknown, now = Date.now()): Promise<void> {
  try {
    const map = await load(storage, now);
    map[key] = { at: now, fields };
    const newest = Object.entries(map)
      .sort((a, b) => b[1].at - a[1].at)
      .slice(0, SCAN_CACHE_MAX_ENTRIES);
    await storage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(newest)));
  } catch {
    // Le cache est un confort : un échec d'écriture ne doit jamais empêcher la lecture du document.
  }
}

export async function clearScanCache(storage: KeyValueStorage): Promise<void> {
  try {
    await storage.removeItem(STORAGE_KEY);
  } catch {
    // rien à faire
  }
}

/** Vrai si au moins un champ a une valeur : une lecture vide n'est jamais mise en cache (on pourra réessayer). */
export function hasAnyFieldValue(fields: unknown): boolean {
  if (typeof fields !== 'object' || fields === null) return false;
  return Object.values(fields as Record<string, unknown>).some((field) => {
    const value = (field as { value?: unknown } | null)?.value;
    return Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined && value !== '';
  });
}

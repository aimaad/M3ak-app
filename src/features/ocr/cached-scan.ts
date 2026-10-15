import { File } from 'expo-file-system';

import { scanInCloud, type CloudDocumentType, type CloudScanResult } from './cloud-ocr';
import { clearScanCache, hasAnyFieldValue, readScanCache, scanCacheKey, writeScanCache, type KeyValueStorage } from './scan-cache';

/** Stockage local de l'appareil ; absent (tests, web) → pas de cache, la lecture fonctionne quand même. */
function deviceStorage(): KeyValueStorage | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module = require('@react-native-async-storage/async-storage') as { default?: KeyValueStorage } & KeyValueStorage;
    return module.default ?? module;
  } catch {
    return null;
  }
}

function fileHash(localUri: string): string | null {
  try {
    return new File(localUri).md5 ?? null;
  } catch {
    return null;
  }
}

export type CachedScanResult = CloudScanResult & { fromCache?: boolean };

/**
 * Lit un document : si cette MÊME photo (même contenu) a déjà été lue pour cette entreprise dans les dernières
 * 24 h, le résultat est repris du cache de l'appareil sans rien envoyer. Sinon, appel au serveur puis mise en cache
 * (seulement si au moins un champ a été lu).
 */
export async function scanCloudCached(
  documentType: CloudDocumentType,
  localUri: string,
  agencyId?: string
): Promise<CachedScanResult> {
  const storage = agencyId ? deviceStorage() : null;
  const hash = storage ? fileHash(localUri) : null;
  const key = agencyId && hash ? scanCacheKey(agencyId, documentType, hash) : null;

  if (storage && key) {
    const cached = await readScanCache(storage, key);
    if (cached) return { ok: true, fields: cached, fromCache: true };
  }

  const result = await scanInCloud(documentType, localUri);
  if (result.ok && storage && key && hasAnyFieldValue(result.fields)) {
    await writeScanCache(storage, key, result.fields);
  }
  return result;
}

/** À la déconnexion : aucune donnée de lecture ne reste sur l'appareil. */
export async function clearDeviceScanCache(): Promise<void> {
  const storage = deviceStorage();
  if (storage) await clearScanCache(storage);
}

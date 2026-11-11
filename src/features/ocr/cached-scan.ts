import { File } from 'expo-file-system';

import { clearInsightsCache } from '@/features/dashboard/insights-cache';
import { scanInCloud, scanInCloudMany, type CloudDocumentType, type CloudScanResult } from './cloud-ocr';
import { clearScanCache, hasAnyFieldValue, readScanCache, scanCacheKey, writeScanCache, type KeyValueStorage } from './scan-cache';

/** Stockage local de l'appareil ; absent (tests, web) → pas de cache, la lecture fonctionne quand même. */
export function deviceStorage(): KeyValueStorage | null {
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

/**
 * Lit PLUSIEURS photos d'un même document (recto et verso) en une seule analyse. Même cache : la clé réunit les empreintes des photos, dans l'ordre
 * (les mêmes deux photos relues dans les 24 h ne sont pas renvoyées au serveur).
 */
export async function scanCloudManyCached(documentType: CloudDocumentType, localUris: string[], agencyId?: string): Promise<CachedScanResult> {
  const storage = agencyId ? deviceStorage() : null;
  const hashes = storage ? localUris.map(fileHash) : [];
  const key = agencyId && hashes.length === localUris.length && hashes.every((hash): hash is string => !!hash) ? scanCacheKey(agencyId, documentType, hashes.join('+')) : null;

  if (storage && key) {
    const cached = await readScanCache(storage, key);
    if (cached) return { ok: true, fields: cached, fromCache: true };
  }

  const result = await scanInCloudMany(documentType, localUris);
  if (result.ok && storage && key && hasAnyFieldValue(result.fields)) {
    await writeScanCache(storage, key, result.fields);
  }
  return result;
}

/** À la déconnexion : aucune lecture de document ni recommandation ne reste sur l'appareil. */
export async function clearDeviceScanCache(): Promise<void> {
  const storage = deviceStorage();
  if (!storage) return;
  await clearScanCache(storage);
  await clearInsightsCache(storage);
}

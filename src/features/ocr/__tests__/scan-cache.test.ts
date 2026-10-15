import {
  hasAnyFieldValue,
  readScanCache,
  scanCacheKey,
  SCAN_CACHE_MAX_ENTRIES,
  SCAN_CACHE_TTL_MS,
  writeScanCache,
  clearScanCache,
  type KeyValueStorage,
} from '../scan-cache';

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => void data.set(k, v),
    removeItem: async (k) => void data.delete(k),
  };
}

const FIELDS = { marque: { value: 'DACIA', confidence: 'high' } };

describe('cache des lectures de documents', () => {
  it('reprend le résultat de la même photo pour la même entreprise et le même type de document', async () => {
    const storage = memoryStorage();
    const key = scanCacheKey('agence-A', 'carte_grise', 'hash1');
    await writeScanCache(storage, key, FIELDS, 1000);
    expect(await readScanCache(storage, key, 2000)).toEqual(FIELDS);
  });

  it("ne mélange ni les entreprises, ni les types de document, ni les photos", async () => {
    const storage = memoryStorage();
    await writeScanCache(storage, scanCacheKey('agence-A', 'carte_grise', 'hash1'), FIELDS, 1000);
    expect(await readScanCache(storage, scanCacheKey('agence-B', 'carte_grise', 'hash1'), 2000)).toBeNull();
    expect(await readScanCache(storage, scanCacheKey('agence-A', 'permis', 'hash1'), 2000)).toBeNull();
    expect(await readScanCache(storage, scanCacheKey('agence-A', 'carte_grise', 'hash2'), 2000)).toBeNull();
  });

  it('oublie les résultats après 24 h', async () => {
    const storage = memoryStorage();
    const key = scanCacheKey('agence-A', 'permis', 'h');
    await writeScanCache(storage, key, FIELDS, 1000);
    expect(await readScanCache(storage, key, 1000 + SCAN_CACHE_TTL_MS - 1)).toEqual(FIELDS);
    expect(await readScanCache(storage, key, 1000 + SCAN_CACHE_TTL_MS + 1)).toBeNull();
  });

  it('garde au plus 20 entrées (les plus récentes)', async () => {
    const storage = memoryStorage();
    for (let i = 0; i < SCAN_CACHE_MAX_ENTRIES + 5; i++) {
      await writeScanCache(storage, scanCacheKey('a', 'permis', `h${i}`), FIELDS, 1000 + i);
    }
    const stored = JSON.parse([...storage.data.values()][0]);
    expect(Object.keys(stored)).toHaveLength(SCAN_CACHE_MAX_ENTRIES);
    expect(await readScanCache(storage, scanCacheKey('a', 'permis', 'h0'), 2000)).toBeNull();
    expect(await readScanCache(storage, scanCacheKey('a', 'permis', `h${SCAN_CACHE_MAX_ENTRIES + 4}`), 2000)).toEqual(FIELDS);
  });

  it('est vidé à la déconnexion', async () => {
    const storage = memoryStorage();
    const key = scanCacheKey('a', 'permis', 'h');
    await writeScanCache(storage, key, FIELDS, 1000);
    await clearScanCache(storage);
    expect(await readScanCache(storage, key, 2000)).toBeNull();
  });

  it('résiste à un stockage corrompu ou en panne', async () => {
    const storage = memoryStorage();
    storage.data.set('m3ak.ocr-cache.v1', '{pas du json');
    expect(await readScanCache(storage, 'x', 1)).toBeNull();
    const broken: KeyValueStorage = { getItem: async () => { throw new Error('x'); }, setItem: async () => { throw new Error('x'); }, removeItem: async () => { throw new Error('x'); } };
    await expect(writeScanCache(broken, 'x', FIELDS)).resolves.toBeUndefined();
    await expect(clearScanCache(broken)).resolves.toBeUndefined();
  });

  it("ne met jamais en cache une lecture vide", () => {
    expect(hasAnyFieldValue({ marque: { value: null, confidence: 'low' }, categories: { value: [], confidence: 'low' } })).toBe(false);
    expect(hasAnyFieldValue({ marque: { value: 'DACIA', confidence: 'high' } })).toBe(true);
    expect(hasAnyFieldValue(null)).toBe(false);
  });
});

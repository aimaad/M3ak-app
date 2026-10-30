import { scanCloudCached } from '../cached-scan';

const mockInvoke = jest.fn();
const mockStore = new Map<string, string>();
let mockMd5: string | null = 'hash-photo-1';

jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({ functions: { invoke: (...a: unknown[]) => mockInvoke(...a) } }),
}));
jest.mock('expo-file-system', () => ({
  File: class {
    base64() { return Promise.resolve('BASE64'); }
    get md5() { return mockMd5; }
  },
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: async (k: string) => mockStore.get(k) ?? null,
    setItem: async (k: string, v: string) => void mockStore.set(k, v),
    removeItem: async (k: string) => void mockStore.delete(k),
  },
}));

const FIELDS = { marque: { value: 'DACIA', confidence: 'high' } };

beforeEach(() => {
  mockInvoke.mockReset().mockResolvedValue({ data: { ok: true, fields: FIELDS }, error: null });
  mockStore.clear();
  mockMd5 = 'hash-photo-1';
});

describe('lecture avec cache', () => {
  it("la 2e lecture de la même photo n'appelle pas le serveur", async () => {
    const first = await scanCloudCached('carte_grise', 'file:///a.jpg', 'agence-A');
    const second = await scanCloudCached('carte_grise', 'file:///a-copie.jpg', 'agence-A');
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(first).toMatchObject({ ok: true });
    expect(first.fromCache).toBeUndefined();
    expect(second).toEqual({ ok: true, fields: FIELDS, fromCache: true });
  });

  it('une autre photo est lue normalement', async () => {
    await scanCloudCached('carte_grise', 'file:///a.jpg', 'agence-A');
    mockMd5 = 'hash-photo-2';
    await scanCloudCached('carte_grise', 'file:///b.jpg', 'agence-A');
    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });

  it("une autre entreprise ne profite pas du cache", async () => {
    await scanCloudCached('carte_grise', 'file:///a.jpg', 'agence-A');
    await scanCloudCached('carte_grise', 'file:///a.jpg', 'agence-B');
    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });

  it("n'enregistre pas un échec ni une lecture vide : on réessaiera", async () => {
    mockInvoke.mockResolvedValueOnce({ data: { ok: false, error: 'ocr_busy' }, error: null });
    expect(await scanCloudCached('carte_grise', 'file:///a.jpg', 'agence-A')).toMatchObject({ ok: false, error: 'ocr_busy' });
    mockInvoke.mockResolvedValueOnce({ data: { ok: true, fields: { marque: { value: null, confidence: 'low' } } }, error: null });
    await scanCloudCached('carte_grise', 'file:///a.jpg', 'agence-A');
    await scanCloudCached('carte_grise', 'file:///a.jpg', 'agence-A');
    expect(mockInvoke).toHaveBeenCalledTimes(3);
  });

  it("sans identifiant d'entreprise ou sans empreinte du fichier, lit normalement (sans cache)", async () => {
    await scanCloudCached('carte_grise', 'file:///a.jpg');
    await scanCloudCached('carte_grise', 'file:///a.jpg');
    mockMd5 = null;
    await scanCloudCached('carte_grise', 'file:///a.jpg', 'agence-A');
    await scanCloudCached('carte_grise', 'file:///a.jpg', 'agence-A');
    expect(mockInvoke).toHaveBeenCalledTimes(4);
  });
});

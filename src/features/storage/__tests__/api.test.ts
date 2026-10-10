import { MAX_UPLOAD_SIZE_BYTES, uploadFile, UploadValidationError } from '../api';

jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    storage: {
      from: () => ({
        upload: jest.fn().mockResolvedValue({ error: null }),
      }),
    },
  }),
}));

function mockFetchWithSize(byteLength: number) {
  globalThis.fetch = jest.fn().mockResolvedValue({
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(byteLength)),
  }) as unknown as typeof fetch;
}

describe('uploadFile — validation', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejette un type de fichier non autorisé', async () => {
    mockFetchWithSize(1000);
    await expect(uploadFile('bucket', 'path', 'file://x', 'application/zip')).rejects.toThrow(UploadValidationError);
  });

  it('accepte une image jpeg de taille raisonnable', async () => {
    mockFetchWithSize(1000);
    await expect(uploadFile('bucket', 'path', 'file://x', 'image/jpeg')).resolves.toBeUndefined();
  });

  it('rejette un fichier vide', async () => {
    mockFetchWithSize(0);
    await expect(uploadFile('bucket', 'path', 'file://x', 'image/jpeg')).rejects.toThrow(UploadValidationError);
  });

  it('rejette un fichier dépassant la taille maximale autorisée', async () => {
    mockFetchWithSize(MAX_UPLOAD_SIZE_BYTES + 1);
    await expect(uploadFile('bucket', 'path', 'file://x', 'image/jpeg')).rejects.toThrow(UploadValidationError);
  });

  it('accepte un fichier exactement à la limite', async () => {
    mockFetchWithSize(MAX_UPLOAD_SIZE_BYTES);
    await expect(uploadFile('bucket', 'path', 'file://x', 'image/jpeg')).resolves.toBeUndefined();
  });
});

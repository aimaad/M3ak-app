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

const JPEG_HEADER = [0xff, 0xd8, 0xff, 0xe0];

function mockFetchWithSize(byteLength: number, header: number[] = JPEG_HEADER) {
  const buffer = new ArrayBuffer(byteLength);
  new Uint8Array(buffer).set(header.slice(0, byteLength));
  globalThis.fetch = jest.fn().mockResolvedValue({
    arrayBuffer: () => Promise.resolve(buffer),
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

  it('rejette un contenu qui ne correspond pas au type annoncé', async () => {
    mockFetchWithSize(1000, [0x50, 0x4b, 0x03, 0x04]); // en-tête ZIP déguisé en JPEG
    await expect(uploadFile('bucket', 'path', 'file://x', 'image/jpeg')).rejects.toThrow('content_type_mismatch');
  });

  it('reconnaît un PNG et un PDF valides', async () => {
    mockFetchWithSize(1000, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    await expect(uploadFile('bucket', 'path', 'file://x', 'image/png')).resolves.toBeUndefined();
    mockFetchWithSize(1000, [0x25, 0x50, 0x44, 0x46]);
    await expect(uploadFile('bucket', 'path', 'file://x', 'application/pdf')).resolves.toBeUndefined();
  });

  it('échoue proprement (sans rien enregistrer) quand le réseau est coupé', async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed')) as unknown as typeof fetch;
    await expect(uploadFile('bucket', 'path', 'file://x', 'image/jpeg')).rejects.toThrow('Network request failed');
  });
});

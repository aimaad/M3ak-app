// Vérifie QUAND une image peut quitter l'appareil : jamais sans l'accord de l'entreprise, jamais vers
// un autre service que la fonction `scan-document`, et la lecture locale reste le repli.
import { scanLicence } from '@/features/customers/licence-ocr';
import { scanVehicleDocument } from '@/features/vehicles/ocr';

import { parseOcrSettings } from '../settings-api';

const mockInvoke = jest.fn();
const mockExtract = jest.fn();
jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({ functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } }),
}));
jest.mock('expo-file-system', () => ({ File: class { base64() { return Promise.resolve('BASE64'); } } }));
jest.mock('expo-text-extractor', () => ({ isSupported: true, extractTextFromImage: (...a: unknown[]) => mockExtract(...a) }));

const LICENCE_TEXT = ['1. ALAOUI', '2. Sara', '4a. 01.05.2019', '4b. 01.05.2029'];
const CLOUD_LICENCE = {
  nom: { value: 'ALAOUI', confidence: 'high' },
  prenom: { value: 'Sara', confidence: 'high' },
  numeroPermis: { value: null, confidence: 'low' },
};

beforeEach(() => {
  mockInvoke.mockReset();
  mockExtract.mockReset();
  mockExtract.mockResolvedValue(LICENCE_TEXT);
});

describe('réglage OCR de l\'entreprise', () => {
  it('ne renvoie jamais de clé et ignore un accord sans clé', () => {
    expect(parseOcrSettings({ cloud_available: false, cloud_enabled: true })).toEqual({ cloudAvailable: false, cloudEnabled: false });
    expect(parseOcrSettings({ cloud_available: true, cloud_enabled: true, gemini_api_key: 'secret' })).toEqual({
      cloudAvailable: true,
      cloudEnabled: true,
    });
    expect(parseOcrSettings(null)).toEqual({ cloudAvailable: false, cloudEnabled: false });
  });
});

describe('permis : où a lieu la lecture', () => {
  it("sans accord de l'entreprise, rien n'est envoyé au serveur (lecture sur l'appareil)", async () => {
    const result = await scanLicence('file:///permis.jpg');
    expect(mockInvoke).not.toHaveBeenCalled();
    expect(result.ok && result.source).toBe('device');
  });

  it('avec accord, utilise uniquement la fonction scan-document', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true, fields: CLOUD_LICENCE }, error: null });
    const result = await scanLicence('file:///permis.jpg', { useCloud: true });
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith('scan-document', {
      body: { documentType: 'permis', imageBase64: 'BASE64', mimeType: 'image/jpeg' },
    });
    expect(mockExtract).not.toHaveBeenCalled();
    expect(result.ok && result.source).toBe('cloud');
  });

  it("si l'analyse cloud échoue, retombe sur la lecture locale (jamais sur un autre service)", async () => {
    mockInvoke.mockResolvedValue({ data: { ok: false, error: 'ocr_failed' }, error: null });
    const result = await scanLicence('file:///permis.jpg', { useCloud: true });
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(result.ok && result.source).toBe('device');
    expect(result.ok && result.cloudError).toBe('ocr_failed');
    expect(result.ok && result.fields.nom.value).toBe('ALAOUI');
  });

  it("l'entreprise sans clé : la fonction répond « non configuré » et la lecture locale prend le relais", async () => {
    mockInvoke.mockResolvedValue({ data: { ok: false, error: 'ocr_not_configured' }, error: null });
    const result = await scanLicence('file:///permis.jpg', { useCloud: true });
    expect(result.ok && result.cloudError).toBe('ocr_not_configured');
  });
});

describe('carte grise : où a lieu la lecture', () => {
  it("sans accord, rien n'est envoyé au serveur", async () => {
    mockExtract.mockResolvedValue(['Marque', 'DACIA']);
    const result = await scanVehicleDocument('file:///cg.jpg');
    expect(mockInvoke).not.toHaveBeenCalled();
    expect(result.ok && result.fields.marque.value).toBe('DACIA');
  });

  it('avec accord, normalise la réponse cloud et rejette les valeurs hors liste', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        ok: true,
        fields: {
          marque: { value: 'DACIA', confidence: 'high' },
          carburant: { value: 'kérosène', confidence: 'high' },
          nombrePlaces: { value: 42, confidence: 'high' },
          annee: { value: '2021', confidence: 'medium' },
        },
      },
      error: null,
    });
    const result = await scanVehicleDocument('file:///cg.jpg', { useCloud: true });
    expect(mockInvoke).toHaveBeenCalledWith('scan-document', expect.objectContaining({ body: expect.objectContaining({ documentType: 'carte_grise' }) }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.fields.marque.value).toBe('DACIA');
      expect(result.fields.carburant.value).toBeNull();
      expect(result.fields.nombrePlaces.value).toBeNull();
      expect(result.fields.annee.value).toBe(2021);
    }
  });
});

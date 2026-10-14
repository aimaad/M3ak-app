// Vérifie QUAND une image peut quitter l'appareil : seulement vers la fonction `scan-document`, qui refuse
// tant que l'entreprise n'a pas de clé ET que son propriétaire n'a pas donné son accord. Aucun repli local.
import { scanLicence } from '@/features/customers/licence-ocr';
import { scanVehicleDocument } from '@/features/vehicles/ocr';

import { inactiveMessageKey, ocrAvailability, scanErrorMessageKey } from '../availability';
import { parseOcrSettings } from '../settings-api';

const mockInvoke = jest.fn();
jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({ functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } }),
}));
jest.mock('expo-file-system', () => ({ File: class { base64() { return Promise.resolve('BASE64'); } } }));

const CLOUD_LICENCE = {
  nom: { value: 'ALAOUI', confidence: 'high' },
  prenom: { value: 'Sara', confidence: 'high' },
  numeroPermis: { value: null, confidence: 'low' },
};

beforeEach(() => mockInvoke.mockReset());

describe("réglage OCR de l'entreprise", () => {
  it('ne renvoie jamais de clé et ignore un accord sans clé', () => {
    expect(parseOcrSettings({ cloud_available: false, cloud_enabled: true })).toEqual({ cloudAvailable: false, cloudEnabled: false });
    expect(parseOcrSettings({ cloud_available: true, cloud_enabled: true, gemini_api_key: 'secret' })).toEqual({ cloudAvailable: true, cloudEnabled: true });
    expect(parseOcrSettings(null)).toEqual({ cloudAvailable: false, cloudEnabled: false });
  });
});

describe('disponibilité de la lecture automatique', () => {
  const none = { cloudAvailable: false, cloudEnabled: false };
  const keyOnly = { cloudAvailable: true, cloudEnabled: false };
  const on = { cloudAvailable: true, cloudEnabled: true };

  it('active seulement avec une clé ET l\'accord du propriétaire', () => {
    expect(ocrAvailability(on, false, 'employee')).toBe('active');
    expect(ocrAvailability(none, false, 'owner')).toBe('no_key');
    expect(ocrAvailability(keyOnly, false, 'owner')).toBe('owner_can_enable');
    expect(ocrAvailability(keyOnly, false, 'manager')).toBe('ask_owner');
    expect(ocrAvailability(keyOnly, false, 'employee')).toBe('ask_owner');
    expect(ocrAvailability(on, true, 'owner')).toBe('loading');
  });
  it("affiche le message « non active pour votre entreprise » quand il n'y a pas de clé", () => {
    expect(inactiveMessageKey('no_key')).toBe('ocr.inactive.noKey');
    expect(inactiveMessageKey('owner_can_enable')).toBe('ocr.inactive.ownerCanEnable');
    expect(inactiveMessageKey('ask_owner')).toBe('ocr.inactive.askOwner');
  });
  it("traduit les erreurs de lecture, « non active » comprise", () => {
    expect(scanErrorMessageKey('ocr_disabled')).toBe('ocr.errors.inactive');
    expect(scanErrorMessageKey('ocr_not_configured')).toBe('ocr.errors.inactive');
    expect(scanErrorMessageKey('ocr_timeout')).toBe('ocr.errors.timeout');
    expect(scanErrorMessageKey('unavailable')).toBe('ocr.errors.unavailable');
    expect(scanErrorMessageKey('nothing_read')).toBe('ocr.errors.nothingRead');
    expect(scanErrorMessageKey('ocr_failed')).toBe('ocr.errors.failed');
    expect(scanErrorMessageKey(null)).toBe('ocr.errors.failed');
  });
});

describe('permis : lecture', () => {
  it('appelle uniquement la fonction scan-document', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true, fields: CLOUD_LICENCE }, error: null });
    const result = await scanLicence('file:///permis.jpg');
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith('scan-document', { body: { documentType: 'permis', imageBase64: 'BASE64', mimeType: 'image/jpeg' } });
    expect(result.ok && result.fields.nom.value).toBe('ALAOUI');
  });

  it("sans clé ou sans accord, la fonction répond « non active » : aucun résultat, aucun repli", async () => {
    mockInvoke.mockResolvedValue({ data: { ok: false, error: 'ocr_not_configured' }, error: null });
    expect(await scanLicence('file:///permis.jpg')).toEqual({ ok: false, error: 'ocr_not_configured' });
    mockInvoke.mockResolvedValue({ data: { ok: false, error: 'ocr_disabled' }, error: null });
    expect(await scanLicence('file:///permis.jpg')).toEqual({ ok: false, error: 'ocr_disabled' });
    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });

  it('une erreur du fournisseur donne un échec propre (saisie manuelle), sans valeur inventée', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: false, error: 'ocr_failed', detail: 'provider_429' }, error: null });
    expect(await scanLicence('file:///permis.jpg')).toEqual({ ok: false, error: 'ocr_failed', detail: 'provider_429' });
  });

  it("un échec d'envoi donne « indisponible » avec la vraie cause et la taille de l'image (aucune donnée du document)", async () => {
    const error = Object.assign(new Error('Failed to send a request to the Edge Function'), { context: new TypeError('Network request failed') });
    mockInvoke.mockResolvedValue({ data: null, error });
    const result = await scanLicence('file:///permis.jpg');
    expect(result).toMatchObject({ ok: false, error: 'unavailable' });
    expect(result.ok === false && result.detail).toContain('Network request failed');
    expect(result.ok === false && result.detail).toMatch(/image \d+ Ko/);
  });

  it('un réseau coupé donne « indisponible »', async () => {
    mockInvoke.mockRejectedValue(new Error('Network request failed'));
    const result = await scanLicence('file:///permis.jpg');
    expect(result).toMatchObject({ ok: false, error: 'unavailable' });
  });
});

describe('carte grise : lecture', () => {
  it('normalise la réponse et rejette les valeurs hors liste', async () => {
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
    const result = await scanVehicleDocument('file:///cg.jpg');
    expect(mockInvoke).toHaveBeenCalledWith('scan-document', expect.objectContaining({ body: expect.objectContaining({ documentType: 'carte_grise' }) }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.fields.marque.value).toBe('DACIA');
      expect(result.fields.carburant.value).toBeNull();
      expect(result.fields.nombrePlaces.value).toBeNull();
      expect(result.fields.annee.value).toBe(2021);
    }
  });

  it('sans clé : « non active », rien n’est lu', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: false, error: 'ocr_not_configured' }, error: null });
    expect(await scanVehicleDocument('file:///cg.jpg')).toEqual({ ok: false, error: 'ocr_not_configured' });
  });
});

/* eslint-disable import/first -- les « jest.mock » doivent précéder les imports */
import { FunctionsHttpError } from '@supabase/supabase-js';

const mockInvoke = jest.fn();
const mockMemory = new Map<string, string>();
jest.mock('@/lib/supabase', () => ({ getSupabase: () => ({ functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } }) }));
jest.mock('expo-file-system', () => ({
  File: function File(this: { uri: string; base64: () => Promise<string>; md5: string }, uri: string) {
    this.uri = uri;
    this.base64 = async () => `b64(${uri})`;
    this.md5 = `md5(${uri})`;
  },
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: async (key: string) => mockMemory.get(key) ?? null,
  setItem: async (key: string, value: string) => void mockMemory.set(key, value),
  removeItem: async (key: string) => void mockMemory.delete(key),
}));

import { scanVehicleDocuments } from '@/features/vehicles/ocr';

const field = (value: unknown, confidence = 'high') => ({ value, confidence });
const RECTO = { immatriculation: field('68013-ب-72'), dateMiseEnCirculation: field('2022-03-15') };
const VERSO = { marque: field('DACIA'), modele: field('SANDERO'), vin: field('UU1HSDAGC56789012'), carburant: field('diesel') };
const legacyRefusal = () => ({ data: null, error: new FunctionsHttpError({ status: 400, json: async () => ({ ok: false, error: 'invalid_image' }) }) });

describe('lecture de la carte grise : les deux faces ensemble, un seul résultat', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockMemory.clear();
  });

  it('une seule requête avec le recto ET le verso, dans l’ordre ; un seul résultat qui réunit les deux faces', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true, fields: { ...RECTO, ...VERSO } }, error: null });
    const result = await scanVehicleDocuments(['file:///recto.jpg', 'file:///verso.jpg'], { agencyId: 'a1' });
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith('scan-document', {
      body: { documentType: 'carte_grise', images: [{ imageBase64: 'b64(file:///recto.jpg)', mimeType: 'image/jpeg' }, { imageBase64: 'b64(file:///verso.jpg)', mimeType: 'image/jpeg' }] },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fields.immatriculation.value).toBe('68013 | ب | 72'); // recto
    expect(result.fields.marque.value).toBe('DACIA'); // verso, dans le même résultat
    expect(result.fields.vin.value).toBe('UU1HSDAGC56789012');
    expect(result.fields.carburant.value).toBe('diesel');
  });

  it('une seule photo (verso facultatif) : l’envoi d’une image, comme avant', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true, fields: RECTO }, error: null });
    const result = await scanVehicleDocuments(['file:///recto.jpg'], { agencyId: 'a1' });
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith('scan-document', { body: { documentType: 'carte_grise', imageBase64: 'b64(file:///recto.jpg)', mimeType: 'image/jpeg' } });
    expect(result.ok).toBe(true);
  });

  it('les deux mêmes photos relues : reprises du cache de l’appareil, rien n’est renvoyé', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true, fields: { ...RECTO, ...VERSO } }, error: null });
    const uris = ['file:///recto.jpg', 'file:///verso.jpg'];
    await scanVehicleDocuments(uris, { agencyId: 'a1' });
    const again = await scanVehicleDocuments(uris, { agencyId: 'a1' });
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(again).toMatchObject({ ok: true, fromCache: true });
    // Une autre paire de photos n'utilise pas ce cache
    await scanVehicleDocuments(['file:///recto.jpg', 'file:///autre-verso.jpg'], { agencyId: 'a1' });
    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });

  it('serveur pas encore mis à jour (il refuse l’envoi de deux photos) : repli sur une lecture par face, en parallèle, puis un seul résultat fusionné', async () => {
    mockInvoke.mockImplementation(async (_name: string, { body }: { body: { images?: unknown; imageBase64?: string } }) => {
      if (body.images) return legacyRefusal();
      return { data: { ok: true, fields: body.imageBase64?.includes('recto') ? RECTO : VERSO }, error: null };
    });
    const result = await scanVehicleDocuments(['file:///recto.jpg', 'file:///verso.jpg'], { agencyId: 'a1' });
    expect(mockInvoke).toHaveBeenCalledTimes(3); // la tentative à deux photos, puis une lecture par face
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fields.immatriculation.value).toBe('68013 | ب | 72');
    expect(result.fields.marque.value).toBe('DACIA');
  });

  it('les autres erreurs ne déclenchent PAS le repli : une seule requête, l’erreur est rendue telle quelle', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: false, error: 'ocr_busy' }, error: null });
    const result = await scanVehicleDocuments(['file:///recto.jpg', 'file:///verso.jpg'], { agencyId: 'a1' });
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ ok: false, error: 'ocr_busy' });
  });

  it('fonction pas déployée : « unavailable », sans repli', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new FunctionsHttpError({ status: 404, json: async () => ({}) }) });
    const result = await scanVehicleDocuments(['file:///recto.jpg', 'file:///verso.jpg'], { agencyId: 'a1' });
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ ok: false, error: 'unavailable' });
  });

  it('aucune photo : erreur claire, aucun appel', async () => {
    expect(await scanVehicleDocuments([], { agencyId: 'a1' })).toMatchObject({ ok: false });
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});

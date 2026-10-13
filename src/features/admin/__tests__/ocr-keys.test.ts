import { adminErrorKey, maskKey, parseAgencyKeyRows, validateGeminiKey } from '../ocr-keys';

describe('parseAgencyKeyRows', () => {
  it('lit la liste du serveur sans jamais exposer de clé', () => {
    const rows = parseAgencyKeyRows([
      { agency_id: 'a1', nom: 'Agence A', ville: 'Casa', key_set: true, key_last4: 'cdef', cloud_enabled: true, key_updated_at: '2026-10-13T10:00:00Z', gemini_api_key: 'SECRET' },
      { agency_id: 'b1', nom: 'Agence B', key_set: false },
      { nom: 'sans identifiant' },
      null,
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ agencyId: 'a1', nom: 'Agence A', ville: 'Casa', keySet: true, keyLast4: 'cdef', cloudEnabled: true, keyUpdatedAt: '2026-10-13T10:00:00Z' });
    expect(JSON.stringify(rows)).not.toContain('SECRET');
    expect(rows[1]).toMatchObject({ keySet: false, keyLast4: null, cloudEnabled: false });
  });
  it('renvoie une liste vide si la réponse est inattendue', () => {
    expect(parseAgencyKeyRows(undefined)).toEqual([]);
    expect(parseAgencyKeyRows({})).toEqual([]);
  });
});

describe('validateGeminiKey', () => {
  it('accepte une clé plausible (avec espaces autour retirés)', () => {
    expect(validateGeminiKey('  AQ.fake-test-key-0123456789abcdef  ')).toBeNull();
    expect(validateGeminiKey('AIzaSyFakeKeyFakeKeyFakeKeyFakeKey1234')).toBeNull();
  });
  it('refuse vide, trop court, trop long, avec espaces', () => {
    expect(validateGeminiKey('   ')).toBe('required');
    expect(validateGeminiKey('court')).toBe('format');
    expect(validateGeminiKey('a'.repeat(201))).toBe('format');
    expect(validateGeminiKey('AQ.cle avec espaces 0123456789')).toBe('format');
  });
});

describe('affichage et erreurs', () => {
  it('masque la clé en ne montrant que 4 caractères', () => {
    expect(maskKey('cdef')).toBe('••••••••cdef');
    expect(maskKey(null)).toBe('');
  });
  it('traduit les erreurs du serveur', () => {
    expect(adminErrorKey({ message: 'invalid_key_format' })).toBe('admin.ocr.errors.format');
    expect(adminErrorKey({ message: 'not_allowed' })).toBe('admin.ocr.errors.notAllowed');
    expect(adminErrorKey({ message: 'agency_not_found' })).toBe('admin.ocr.errors.agencyNotFound');
    expect(adminErrorKey(new Error('réseau'))).toBe('admin.ocr.errors.generic');
  });
});

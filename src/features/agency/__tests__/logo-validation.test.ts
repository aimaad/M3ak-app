import { LOGO_MAX_BYTES, logoContentType, logoUploadErrorCode, validateLogoAsset } from '../logo-validation';

describe('contrôles du logo', () => {
  it('accepte un PNG ou un JPEG de bonne taille', () => {
    expect(validateLogoAsset({ uri: 'file:///a/logo.png', width: 400, height: 400, fileSize: 120_000, mimeType: 'image/png' })).toBeNull();
    expect(validateLogoAsset({ uri: 'file:///a/photo.jpg', width: 800, height: 600, fileSize: 500_000, mimeType: 'image/jpeg' })).toBeNull();
    expect(validateLogoAsset({ uri: 'file:///a/photo.jpeg' })).toBeNull();
  });

  it('refuse un autre format (gif, webp, pdf, svg…)', () => {
    for (const mimeType of ['image/gif', 'image/webp', 'application/pdf', 'image/svg+xml']) {
      expect(validateLogoAsset({ uri: 'file:///a/x', mimeType, width: 500, height: 500 })).toBe('unsupported_type');
    }
    expect(validateLogoAsset({ uri: 'file:///a/logo.gif' })).toBe('unsupported_type');
  });

  it('refuse une image trop lourde, vide ou trop petite', () => {
    expect(validateLogoAsset({ uri: 'file:///a.png', mimeType: 'image/png', fileSize: LOGO_MAX_BYTES + 1 })).toBe('too_large');
    expect(validateLogoAsset({ uri: 'file:///a.png', mimeType: 'image/png', fileSize: 0 })).toBe('empty');
    expect(validateLogoAsset({ uri: 'file:///a.png', mimeType: 'image/png', width: 100, height: 600 })).toBe('too_small');
    expect(validateLogoAsset({ uri: '' })).toBe('unreadable');
  });

  it('devine le type depuis l\'extension quand le téléphone ne le donne pas', () => {
    expect(logoContentType({ uri: 'file:///x/logo.PNG?cache=1' })).toBe('image/png');
    expect(logoContentType({ uri: 'file:///x/logo', mimeType: undefined })).toBeNull();
  });

  it('transforme une erreur technique d\'envoi en cause simple', () => {
    expect(logoUploadErrorCode(new Error('Network request failed'))).toBe('network');
    expect(logoUploadErrorCode(new Error('The object exceeded the maximum allowed size'))).toBe('too_large');
    expect(logoUploadErrorCode(new Error('new row violates row-level security policy'))).toBe('permission');
    expect(logoUploadErrorCode(new Error('content_type_mismatch'))).toBe('unsupported_type');
    expect(logoUploadErrorCode(new Error('quelque chose'))).toBe('failed');
  });
});

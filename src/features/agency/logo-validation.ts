/**
 * Contrôles d'un logo AVANT l'envoi, avec des erreurs que l'on peut expliquer en une phrase simple.
 * (Le contenu réel du fichier est ensuite revérifié à l'envoi : PNG ou JPEG uniquement.)
 */
export const LOGO_MAX_BYTES = 5 * 1024 * 1024;
export const LOGO_MIN_SIDE = 150;

export type LogoErrorCode = 'unsupported_type' | 'too_large' | 'too_small' | 'unreadable' | 'empty';

export type LogoAsset = { uri: string; width?: number; height?: number; fileSize?: number | null; mimeType?: string | null };

export function logoContentType(asset: Pick<LogoAsset, 'uri' | 'mimeType'>): 'image/png' | 'image/jpeg' | null {
  const mime = asset.mimeType?.toLowerCase();
  if (mime === 'image/png') return 'image/png';
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'image/jpeg';
  if (mime) return null;
  const extension = asset.uri.split('?')[0].split('.').pop()?.toLowerCase();
  if (extension === 'png') return 'image/png';
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  return null;
}

export function validateLogoAsset(asset: LogoAsset): LogoErrorCode | null {
  if (!asset.uri) return 'unreadable';
  if (logoContentType(asset) === null) return 'unsupported_type';
  if (asset.fileSize === 0) return 'empty';
  if (asset.fileSize != null && asset.fileSize > LOGO_MAX_BYTES) return 'too_large';
  if (asset.width != null && asset.height != null && Math.min(asset.width, asset.height) < LOGO_MIN_SIDE) return 'too_small';
  return null;
}

/** Erreur technique d'envoi → code simple (les autres erreurs deviennent un message générique « réessayez »). */
export function logoUploadErrorCode(error: unknown): LogoErrorCode | 'network' | 'permission' | 'failed' {
  const text = (error instanceof Error ? error.message : String(error)).toLowerCase();
  if (/file_too_large|payload too large|exceeded the maximum|\b413\b/.test(text)) return 'too_large';
  if (/file_empty/.test(text)) return 'empty';
  if (/content_type_mismatch|unsupported_content_type|mime type/.test(text)) return 'unsupported_type';
  if (/network request failed|failed to fetch|timed out|timeout|internet|offline|connection/.test(text)) return 'network';
  if (/row-level security|permission denied|not_authenticated|unauthorized|\b40[13]\b/.test(text)) return 'permission';
  return 'failed';
}

import { getSupabase } from '@/lib/supabase';

/** 15 Mo : largement suffisant pour une photo compressée ou un PDF de contrat,
 * sans laisser un fichier anormalement volumineux consommer du stockage. */
export const MAX_UPLOAD_SIZE_BYTES = 15 * 1024 * 1024;

const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

/** Liens temporaires de consultation : courts (10 min) car ils donnent accès à des documents d'identité. */
export const SIGNED_URL_TTL_SECONDS = 600;

export class UploadValidationError extends Error {}

const startsWith = (bytes: Uint8Array, signature: number[]) => signature.every((value, index) => bytes[index] === value);

/** Le contenu réel doit correspondre au type annoncé (JPEG, PNG ou PDF) : une extension ne suffit pas. */
export function contentMatchesType(bytes: Uint8Array, contentType: string): boolean {
  if (contentType === 'image/jpeg') return startsWith(bytes, [0xff, 0xd8, 0xff]);
  if (contentType === 'image/png') return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (contentType === 'application/pdf') return startsWith(bytes, [0x25, 0x50, 0x44, 0x46]);
  return false;
}

export async function uploadFile(
  bucket: string,
  path: string,
  localUri: string,
  contentType = 'image/jpeg'
): Promise<void> {
  if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
    throw new UploadValidationError(`unsupported_content_type: ${contentType}`);
  }

  const response = await fetch(localUri);
  const arrayBuffer = await response.arrayBuffer();

  if (arrayBuffer.byteLength > MAX_UPLOAD_SIZE_BYTES) {
    throw new UploadValidationError('file_too_large');
  }
  if (arrayBuffer.byteLength === 0) {
    throw new UploadValidationError('file_empty');
  }

  if (!contentMatchesType(new Uint8Array(arrayBuffer, 0, Math.min(8, arrayBuffer.byteLength)), contentType)) {
    throw new UploadValidationError('content_type_mismatch');
  }

  const { error } = await getSupabase()
    .storage.from(bucket)
    .upload(path, arrayBuffer, { contentType, upsert: true });

  if (error) throw error;
}

export async function getSignedUrl(bucket: string, path: string, expiresInSeconds = SIGNED_URL_TTL_SECONDS): Promise<string> {
  const { data, error } = await getSupabase().storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

/** Octets → base64 (par blocs, pour ne pas saturer la pile sur une image de quelques centaines de Ko). */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Image d'un bucket privé → data URI (pour l'intégrer dans un PDF). Null si absente, trop lourde ou d'un autre type. */
export async function downloadImageAsDataUri(bucket: string, path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const response = await fetch(await getSignedUrl(bucket, path));
  if (!response.ok) return null;
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length === 0 || bytes.length > 3 * 1024 * 1024) return null;
  if (contentMatchesType(bytes, 'image/png')) return `data:image/png;base64,${bytesToBase64(bytes)}`;
  if (contentMatchesType(bytes, 'image/jpeg')) return `data:image/jpeg;base64,${bytesToBase64(bytes)}`;
  return null;
}

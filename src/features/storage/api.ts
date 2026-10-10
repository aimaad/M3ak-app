import { getSupabase } from '@/lib/supabase';

/** 15 Mo : largement suffisant pour une photo compressée ou un PDF de contrat,
 * sans laisser un fichier anormalement volumineux consommer du stockage. */
export const MAX_UPLOAD_SIZE_BYTES = 15 * 1024 * 1024;

const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

export class UploadValidationError extends Error {}

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

  const { error } = await getSupabase()
    .storage.from(bucket)
    .upload(path, arrayBuffer, { contentType, upsert: true });

  if (error) throw error;
}

export async function getSignedUrl(bucket: string, path: string, expiresInSeconds = 3600): Promise<string> {
  const { data, error } = await getSupabase().storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

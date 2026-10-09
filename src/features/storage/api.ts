import { getSupabase } from '@/lib/supabase';

export async function uploadFile(
  bucket: string,
  path: string,
  localUri: string,
  contentType = 'image/jpeg'
): Promise<void> {
  const response = await fetch(localUri);
  const arrayBuffer = await response.arrayBuffer();

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

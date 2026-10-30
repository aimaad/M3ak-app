import * as LegacyFileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';

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

export type UploadProgress = { stage: 'checking' | 'uploading' | 'done'; /** 0 à 1 */ fraction: number };

/**
 * Même contrôles que `uploadFile` (type, taille, contenu réel), mais l'envoi suit sa progression octet par octet pour
 * afficher une barre de chargement. Le fichier est envoyé en binaire à l'API de stockage, avec la session de l'utilisateur.
 */
/** Sans aucune avancée pendant ce délai, l'envoi est abandonné (connexion coupée ou trop faible). */
export const UPLOAD_STALL_MS = 45_000;
/** Durée maximale totale d'un envoi. */
export const UPLOAD_MAX_MS = 120_000;

export async function uploadFileWithProgress(
  bucket: string,
  path: string,
  localUri: string,
  contentType: string,
  onProgress: (progress: UploadProgress) => void,
  signal?: AbortSignal
): Promise<void> {
  if (Platform.OS === 'web') {
    // Navigateur : pas d'envoi par tâche native ; envoi direct (sans progression octet par octet).
    onProgress({ stage: 'uploading', fraction: 0 });
    await uploadFile(bucket, path, localUri, contentType);
    onProgress({ stage: 'done', fraction: 1 });
    return;
  }
  onProgress({ stage: 'checking', fraction: 0 });
  if (!ALLOWED_CONTENT_TYPES.includes(contentType)) throw new UploadValidationError(`unsupported_content_type: ${contentType}`);

  const buffer = await (await fetch(localUri)).arrayBuffer();
  if (buffer.byteLength === 0) throw new UploadValidationError('file_empty');
  if (buffer.byteLength > MAX_UPLOAD_SIZE_BYTES) throw new UploadValidationError('file_too_large');
  if (!contentMatchesType(new Uint8Array(buffer, 0, Math.min(8, buffer.byteLength)), contentType)) throw new UploadValidationError('content_type_mismatch');

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const { data: session } = await getSupabase().auth.getSession();
  const token = session.session?.access_token;
  if (!supabaseUrl || !anonKey || !token) throw new Error('not_authenticated');

  onProgress({ stage: 'uploading', fraction: 0 });
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const task = LegacyFileSystem.createUploadTask(
    `${supabaseUrl}/storage/v1/object/${bucket}/${encodedPath}`,
    localUri,
    {
      httpMethod: 'POST',
      uploadType: LegacyFileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey, 'Content-Type': contentType, 'x-upsert': 'true', 'cache-control': '3600' },
    },
    (event) => {
      lastProgressAt = Date.now();
      if (event.totalBytesExpectedToSend > 0) onProgress({ stage: 'uploading', fraction: Math.min(1, event.totalBytesSent / event.totalBytesExpectedToSend) });
    }
  );

  // Garde-fous : l'envoi s'arrête (au lieu de rester bloqué) si la connexion n'avance plus, si c'est trop long ou si l'utilisateur annule.
  const startedAt = Date.now();
  let lastProgressAt = Date.now();
  let abortReason: 'upload_timeout' | 'upload_cancelled' | null = null;
  const abort = (reason: 'upload_timeout' | 'upload_cancelled') => {
    if (abortReason) return;
    abortReason = reason;
    task.cancelAsync().catch(() => undefined);
  };
  const watchdog = setInterval(() => {
    if (Date.now() - lastProgressAt > UPLOAD_STALL_MS || Date.now() - startedAt > UPLOAD_MAX_MS) abort('upload_timeout');
  }, 2_000);
  const onAbort = () => abort('upload_cancelled');
  if (signal?.aborted) onAbort();
  signal?.addEventListener('abort', onAbort);

  let result: Awaited<ReturnType<typeof task.uploadAsync>>;
  try {
    result = await task.uploadAsync();
  } catch (error) {
    if (abortReason) throw new Error(abortReason);
    throw error;
  } finally {
    clearInterval(watchdog);
    signal?.removeEventListener('abort', onAbort);
  }
  if (abortReason) throw new Error(abortReason);
  if (!result || result.status < 200 || result.status >= 300) {
    let message = `upload_failed_${result?.status ?? 0}`;
    try {
      message = (JSON.parse(result?.body ?? '{}') as { message?: string }).message ?? message;
    } catch {
      // corps non JSON
    }
    throw new Error(message);
  }
  onProgress({ stage: 'done', fraction: 1 });
}

const PDF_IMAGE_MAX_SIDE = 700;

/**
 * Image d'un bucket privé prête à entrer dans un PDF : téléchargée puis réduite (côté le plus long 700 px). Une photo de
 * téléphone de plusieurs Mo devient une image de quelques dizaines de Ko, et tient dans le PDF. Null si l'image est
 * absente ou illisible (l'appelant doit alors le signaler, pas l'ignorer).
 */
async function reducedDataUri(uri: string, isPng: boolean): Promise<string | null> {
  const info = await ImageManipulator.manipulateAsync(uri, [], {});
  const longest = Math.max(info.width, info.height);
  const actions = longest > PDF_IMAGE_MAX_SIDE ? [{ resize: info.width >= info.height ? { width: PDF_IMAGE_MAX_SIDE } : { height: PDF_IMAGE_MAX_SIDE } }] : [];
  const out = await ImageManipulator.manipulateAsync(uri, actions, {
    compress: 0.85,
    format: isPng ? ImageManipulator.SaveFormat.PNG : ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });
  return out.base64 ? `data:image/${isPng ? 'png' : 'jpeg'};base64,${out.base64}` : null;
}

/** Version navigateur : pas de système de fichiers, on passe par un lien d'objet en mémoire. */
async function loadImageForPdfWeb(signedUrl: string, path: string): Promise<string | null> {
  const response = await fetch(signedUrl);
  if (!response.ok) return null;
  const objectUrl = URL.createObjectURL(await response.blob());
  try {
    return await reducedDataUri(objectUrl, /\.png$/i.test(path));
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function loadImageForPdf(bucket: string, path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const signedUrl = await getSignedUrl(bucket, path);
  if (Platform.OS === 'web') return loadImageForPdfWeb(signedUrl, path);
  const target = `${LegacyFileSystem.cacheDirectory}pdf-image-${Date.now()}.${/\.png$/i.test(path) ? 'png' : 'jpg'}`;
  try {
    const download = await LegacyFileSystem.downloadAsync(signedUrl, target);
    if (download.status < 200 || download.status >= 300) return null;
    const isPng = /\.png$/i.test(path);
    const info = await ImageManipulator.manipulateAsync(download.uri, [], {});
    const longest = Math.max(info.width, info.height);
    const actions = longest > PDF_IMAGE_MAX_SIDE ? [{ resize: info.width >= info.height ? { width: PDF_IMAGE_MAX_SIDE } : { height: PDF_IMAGE_MAX_SIDE } }] : [];
    const out = await ImageManipulator.manipulateAsync(download.uri, actions, {
      compress: 0.85,
      format: isPng ? ImageManipulator.SaveFormat.PNG : ImageManipulator.SaveFormat.JPEG,
      base64: true,
    });
    return out.base64 ? `data:image/${isPng ? 'png' : 'jpeg'};base64,${out.base64}` : null;
  } catch {
    return null;
  } finally {
    LegacyFileSystem.deleteAsync(target, { idempotent: true }).catch(() => undefined);
  }
}

const PHOTO_MAX_SIDE = 1800;

/**
 * Photo de document (permis, CIN…) réduite avant l'envoi : une photo de téléphone de 3 à 6 Mo devient ~300-600 Ko,
 * toujours très lisible, donc l'enregistrement est bien plus rapide. Au mieux : en cas d'échec, l'original est envoyé.
 */
export async function shrinkPhotoForUpload(uri: string, maxSide = PHOTO_MAX_SIDE): Promise<string> {
  try {
    const info = await ImageManipulator.manipulateAsync(uri, [], {});
    if (Math.max(info.width, info.height) <= maxSide) return uri;
    const resize = info.width >= info.height ? { width: maxSide } : { height: maxSide };
    const out = await ImageManipulator.manipulateAsync(uri, [{ resize }], { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG });
    return out.uri;
  } catch {
    return uri;
  }
}

/** Réduit une image choisie par l'utilisateur avant l'envoi (logo) : plus rapide à envoyer, même rendu dans le contrat. */
export async function shrinkImageForUpload(
  uri: string,
  contentType: 'image/png' | 'image/jpeg',
  width: number | undefined,
  height: number | undefined,
  maxSide = 1000
): Promise<{ uri: string; contentType: 'image/png' | 'image/jpeg' }> {
  try {
    const longest = Math.max(width ?? 0, height ?? 0);
    if (longest > 0 && longest <= maxSide) return { uri, contentType };
    const resize = (width ?? 0) >= (height ?? 0) ? { width: maxSide } : { height: maxSide };
    const out = await ImageManipulator.manipulateAsync(uri, [{ resize }], {
      compress: 0.9,
      format: contentType === 'image/png' ? ImageManipulator.SaveFormat.PNG : ImageManipulator.SaveFormat.JPEG,
    });
    return { uri: out.uri, contentType };
  } catch {
    return { uri, contentType };
  }
}

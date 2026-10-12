import { FunctionsHttpError } from '@supabase/supabase-js';
import { File } from 'expo-file-system';

import { getSupabase } from '@/lib/supabase';

import type { FuelType, VehicleCategory } from './types';

export type OcrConfidence = 'high' | 'medium' | 'low';
export type OcrField<T> = { value: T | null; confidence: OcrConfidence };

export type VehicleOcrFields = {
  immatriculation: OcrField<string>;
  vin: OcrField<string>;
  marque: OcrField<string>;
  modele: OcrField<string>;
  finition: OcrField<string>;
  annee: OcrField<number>;
  couleur: OcrField<string>;
  nombrePlaces: OcrField<number>;
  carburant: OcrField<FuelType>;
  categorie: OcrField<VehicleCategory>;
};

export type ScanErrorCode =
  | 'ocr_not_configured'
  | 'ocr_failed'
  | 'not_authenticated'
  | 'invalid_image'
  | 'image_too_large'
  | 'unavailable';

export type ScanVehicleDocumentResult = { ok: true; fields: VehicleOcrFields } | { ok: false; error: ScanErrorCode };

function guessMimeType(uri: string): string {
  const extension = uri.split('.').pop()?.split('?')[0]?.toLowerCase();
  return extension === 'png' ? 'image/png' : 'image/jpeg';
}

export async function scanVehicleDocument(localUri: string): Promise<ScanVehicleDocumentResult> {
  const imageBase64 = await new File(localUri).base64();
  const mimeType = guessMimeType(localUri);

  const { data, error } = await getSupabase().functions.invoke('scan-vehicle-document', {
    body: { imageBase64, mimeType },
  });

  if (error) {
    if (error instanceof FunctionsHttpError) {
      const parsed = (await error.context.json().catch(() => null)) as { error?: ScanErrorCode } | null;
      return { ok: false, error: parsed?.error ?? 'ocr_failed' };
    }
    return { ok: false, error: 'unavailable' };
  }

  return data as ScanVehicleDocumentResult;
}

import { recognizeLines } from '@/features/ocr/local-ocr';
import { parseRegistrationText } from '@/features/ocr/registration-parser';

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

/** `ocr_unavailable` : module d'OCR local absent (ex. Expo Go) ; `ocr_failed` : la lecture locale a échoué. */
export type ScanErrorCode = 'ocr_unavailable' | 'ocr_failed';

export type ScanVehicleDocumentResult = { ok: true; fields: VehicleOcrFields } | { ok: false; error: ScanErrorCode };

/**
 * Lit la carte grise par OCR LOCAL (sur l'appareil) : la photo n'est envoyée à aucun service d'analyse.
 * Le résultat reste à vérifier par l'employé avant tout enregistrement.
 */
export async function scanVehicleDocument(localUri: string): Promise<ScanVehicleDocumentResult> {
  const recognized = await recognizeLines(localUri);
  if (!recognized.ok) return { ok: false, error: recognized.error };
  return { ok: true, fields: parseRegistrationText(recognized.lines) };
}

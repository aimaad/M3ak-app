import { FunctionsHttpError } from '@supabase/supabase-js';
import { File } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

import { getSupabase } from '@/lib/supabase';

import { ensureSignatures, parseTemplate, type ContractTemplate } from './template';
import { templateFromTranscription } from './template-from-text';

export type StoredTemplate = { template: ContractTemplate; sourceName: string | null; updatedAt: string };

/** Modèle de contrat de l'agence, ou null (= modèle M3ak standard). Un contenu invalide est traité comme absent. */
export async function getContractTemplate(agencyId: string): Promise<StoredTemplate | null> {
  const { data, error } = await getSupabase()
    .from('agency_contract_templates')
    .select('template, source_name, updated_at')
    .eq('agency_id', agencyId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const template = parseTemplate(data.template);
  return template ? { template: ensureSignatures(template), sourceName: data.source_name, updatedAt: data.updated_at } : null;
}

export async function saveContractTemplate(agencyId: string, template: ContractTemplate, sourceName: string | null): Promise<void> {
  const valid = parseTemplate(template);
  if (!valid) throw new Error('invalid_template');
  const { error } = await getSupabase()
    .from('agency_contract_templates')
    .upsert({ agency_id: agencyId, template: ensureSignatures(valid), source_name: sourceName?.slice(0, 120) ?? null }, { onConflict: 'agency_id' });
  if (error) throw error;
}

export async function removeContractTemplate(agencyId: string): Promise<void> {
  const { error } = await getSupabase().from('agency_contract_templates').delete().eq('agency_id', agencyId);
  if (error) throw error;
}

export type TemplateSourceFile = { uri: string; mimeType: 'image/jpeg' | 'image/png' | 'application/pdf'; name?: string };

export type TemplateAnalysisError =
  | 'ocr_disabled' | 'ocr_not_configured' | 'ocr_failed' | 'ocr_timeout' | 'ocr_busy' | 'unavailable'
  | 'template_unreadable' | 'template_limit' | 'owner_only' | 'invalid_file' | 'file_too_large';

export type TemplateAnalysisResult = { ok: true; template: ContractTemplate } | { ok: false; error: TemplateAnalysisError; detail?: string };

const KNOWN: TemplateAnalysisError[] = [
  'ocr_disabled', 'ocr_not_configured', 'ocr_timeout', 'ocr_busy', 'template_unreadable', 'template_limit', 'owner_only', 'invalid_file', 'file_too_large',
];
const asCode = (raw: unknown): TemplateAnalysisError => (KNOWN.includes(raw as TemplateAnalysisError) ? (raw as TemplateAnalysisError) : 'ocr_failed');

/** La lecture d'un contrat prend plus de temps que celle d'un permis : le serveur répond en moins de 2 minutes. */
const ANALYSIS_TIMEOUT_MS = 130_000;

/**
 * Envoie l'exemple de contrat à la fonction serveur UNE fois ; le modèle vierge obtenu est ensuite enregistré par
 * l'appelant. Rien n'est conservé du fichier envoyé.
 */
/** Une photo de téléphone (plusieurs Mo) est réduite à 1800 px de large : lisible pour l'IA, 10 fois plus légère à envoyer. */
const MAX_IMAGE_WIDTH = 1800;

async function prepareFile(file: TemplateSourceFile): Promise<{ mimeType: string; data: string }> {
  if (file.mimeType === 'application/pdf') return { mimeType: file.mimeType, data: await new File(file.uri).base64() };
  try {
    const resized = await ImageManipulator.manipulateAsync(file.uri, [{ resize: { width: MAX_IMAGE_WIDTH } }], {
      compress: 0.7,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    });
    if (resized.base64) return { mimeType: 'image/jpeg', data: resized.base64 };
  } catch {
    // réduction impossible : on envoie l'original
  }
  return { mimeType: file.mimeType, data: await new File(file.uri).base64() };
}

export async function analyzeContractFiles(files: TemplateSourceFile[]): Promise<TemplateAnalysisResult> {
  try {
    const payload = await Promise.all(files.map(prepareFile));
    const timeout = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), ANALYSIS_TIMEOUT_MS));
    const outcome = await Promise.race([getSupabase().functions.invoke('analyze-contract-template', { body: { files: payload } }), timeout]);
    if (outcome === 'timeout') return { ok: false, error: 'ocr_timeout', detail: 'stage:app' };
    const { data, error } = outcome;

    if (error) {
      if (error instanceof FunctionsHttpError) {
        if (error.context.status === 404) return { ok: false, error: 'unavailable', detail: 'function_not_deployed' };
        const parsed = (await error.context.json().catch(() => null)) as { error?: unknown; detail?: unknown } | null;
        return { ok: false, error: asCode(parsed?.error), detail: typeof parsed?.detail === 'string' ? parsed.detail : undefined };
      }
      return { ok: false, error: 'unavailable', detail: error.message };
    }

    const result = data as { ok?: boolean; error?: unknown; text?: unknown; detail?: unknown } | null;
    if (result?.ok) {
      // L'IA a seulement recopié le texte : la mise en forme est faite ici, sans nouvel appel.
      const template = typeof result.text === 'string' ? templateFromTranscription(result.text) : null;
      return template && parseTemplate(template) ? { ok: true, template } : { ok: false, error: 'template_unreadable' };
    }
    return { ok: false, error: asCode(result?.error), detail: typeof result?.detail === 'string' ? result.detail : undefined };
  } catch (error) {
    return { ok: false, error: 'unavailable', detail: error instanceof Error ? error.message : 'unknown' };
  }
}

/** Clé de traduction du message d'erreur d'une analyse de modèle (texte simple, jamais de code). */
export function templateErrorMessageKey(code: TemplateAnalysisError): string {
  switch (code) {
    case 'ocr_disabled':
    case 'ocr_not_configured':
      return 'contractTemplate.errors.inactive';
    case 'ocr_timeout':
      return 'contractTemplate.errors.timeout';
    case 'ocr_busy':
      return 'ocr.errors.busy';
    case 'unavailable':
      return 'ocr.errors.unavailable';
    case 'template_unreadable':
      return 'contractTemplate.errors.unreadable';
    case 'template_limit':
      return 'contractTemplate.errors.limit';
    case 'owner_only':
      return 'contractTemplate.errors.ownerOnly';
    case 'file_too_large':
      return 'contractTemplate.errors.tooLarge';
    case 'invalid_file':
      return 'contractTemplate.errors.invalidFile';
    default:
      return 'contractTemplate.errors.failed';
  }
}

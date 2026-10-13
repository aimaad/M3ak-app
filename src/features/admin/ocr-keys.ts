/**
 * Administration plateforme : clés Gemini des entreprises. La clé est en ÉCRITURE SEULE : l'app peut
 * l'enregistrer ou la retirer, jamais la relire (le serveur ne renvoie que « configurée » + 4 derniers caractères).
 */
export type AgencyOcrKeyRow = {
  agencyId: string;
  nom: string;
  ville: string | null;
  keySet: boolean;
  /** 4 derniers caractères de la clé, pour reconnaître laquelle est en place. */
  keyLast4: string | null;
  cloudEnabled: boolean;
  keyUpdatedAt: string | null;
};

export function parseAgencyKeyRows(raw: unknown): AgencyOcrKeyRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
    .map((row) => ({
      agencyId: String(row.agency_id ?? ''),
      nom: typeof row.nom === 'string' ? row.nom : '—',
      ville: typeof row.ville === 'string' ? row.ville : null,
      keySet: row.key_set === true,
      keyLast4: typeof row.key_last4 === 'string' ? row.key_last4 : null,
      cloudEnabled: row.cloud_enabled === true,
      keyUpdatedAt: typeof row.key_updated_at === 'string' ? row.key_updated_at : null,
    }))
    .filter((row) => row.agencyId !== '');
}

export type KeyFormError = 'required' | 'format';

/** Même règle que le serveur : 20 à 200 caractères, sans espace. Le serveur reste l'autorité. */
export function validateGeminiKey(raw: string): KeyFormError | null {
  const key = raw.trim();
  if (!key) return 'required';
  if (key.length < 20 || key.length > 200 || /\s/.test(key)) return 'format';
  return null;
}

/** Texte à montrer pour une clé en place, sans jamais la révéler. */
export function maskKey(last4: string | null): string {
  return last4 ? `••••••••${last4}` : '';
}

export function adminErrorKey(error: unknown): string {
  const message = typeof error === 'object' && error !== null && 'message' in error ? String((error as { message: unknown }).message) : '';
  if (message.includes('invalid_key_format')) return 'admin.ocr.errors.format';
  if (message.includes('agency_not_found')) return 'admin.ocr.errors.agencyNotFound';
  if (message.includes('not_allowed')) return 'admin.ocr.errors.notAllowed';
  return 'admin.ocr.errors.generic';
}

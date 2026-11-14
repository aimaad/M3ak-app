type Failure = { message?: unknown; code?: unknown; details?: unknown; hint?: unknown };

const asFailure = (error: unknown): Failure => (typeof error === 'object' && error !== null ? (error as Failure) : {});

/**
 * La base n'a pas la colonne demandée : une migration (0071 : périodicité des échéances) n'est pas encore appliquée.
 * PostgREST répond « Could not find the 'repeat_km' column … in the schema cache » (PGRST204) ou « column … does not exist » (42703).
 */
export function isSchemaOutdatedError(error: unknown): boolean {
  const { message, code } = asFailure(error);
  const text = typeof message === 'string' ? message : '';
  return code === 'PGRST204' || code === '42703' || /repeat_km|repeat_months|period_months|schema cache/i.test(text);
}

/** Petit détail technique (une ligne, 140 caractères au plus) à montrer sous le message : jamais un message vide. */
export function saveErrorDetail(error: unknown): string | null {
  const { message } = asFailure(error);
  if (typeof message !== 'string' || message.trim() === '') return null;
  const line = message.trim().split('\n')[0];
  return line.length > 140 ? `${line.slice(0, 137)}…` : line;
}

/** Message affiché : la raison connue d'abord (base pas à jour), sinon le message générique + le détail technique. */
export function describeSaveError(error: unknown, t: (key: string, params?: Record<string, unknown>) => string, genericKey: string): string {
  if (isSchemaOutdatedError(error)) return t('vehicleDetail.saveErrors.schemaOutdated');
  const detail = saveErrorDetail(error);
  return detail ? `${t(genericKey)} ${t('vehicleDetail.saveErrors.detail', { detail })}` : t(genericKey);
}

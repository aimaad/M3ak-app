import type { AgencyRole } from '@/features/agency/types';

import type { OcrSettings } from './settings-api';

/**
 * La lecture automatique des documents n'existe que si l'entreprise a une clé (configurée par M3AK) ET que son
 * propriétaire l'a activée. Sinon l'écran l'indique clairement et propose la saisie manuelle.
 */
export type OcrAvailability = 'loading' | 'active' | 'no_key' | 'owner_can_enable' | 'ask_owner';

export function ocrAvailability(settings: OcrSettings, isLoading: boolean, role: AgencyRole | null | undefined): OcrAvailability {
  if (isLoading) return 'loading';
  if (settings.cloudEnabled) return 'active';
  if (!settings.cloudAvailable) return 'no_key';
  return role === 'owner' ? 'owner_can_enable' : 'ask_owner';
}

/** Clé de traduction du message « fonction non active » correspondant. */
export function inactiveMessageKey(availability: OcrAvailability): string {
  if (availability === 'owner_can_enable') return 'ocr.inactive.ownerCanEnable';
  if (availability === 'ask_owner') return 'ocr.inactive.askOwner';
  return 'ocr.inactive.noKey';
}

/** Clé de traduction du message d'erreur d'une lecture (`nothing_read` = l'analyse n'a rien pu lire). */
export function scanErrorMessageKey(code: string | null): string {
  switch (code) {
    case 'ocr_disabled':
    case 'ocr_not_configured':
      return 'ocr.errors.inactive';
    case 'ocr_timeout':
      return 'ocr.errors.timeout';
    case 'ocr_busy':
      return 'ocr.errors.busy';
    case 'unavailable':
      return 'ocr.errors.unavailable';
    case 'nothing_read':
      return 'ocr.errors.nothingRead';
    default:
      return 'ocr.errors.failed';
  }
}

/**
 * Disponibilité des recommandations IA de l'accueil : mêmes règles que la lecture des documents (clé de l'entreprise
 * configurée par M3AK + accord du propriétaire), et réservées au propriétaire et au responsable.
 */
export type InsightsAvailability = 'loading' | 'active' | 'no_key' | 'owner_can_enable' | 'ask_owner' | 'role_not_allowed';

export function insightsAvailability(
  settings: OcrSettings,
  isLoading: boolean,
  role: AgencyRole | null | undefined
): InsightsAvailability {
  if (role !== 'owner' && role !== 'manager') return 'role_not_allowed';
  if (isLoading) return 'loading';
  if (settings.insightsEnabled) return 'active';
  if (!settings.cloudAvailable) return 'no_key';
  return role === 'owner' ? 'owner_can_enable' : 'ask_owner';
}

/** Disponibilité du Chat M3ak : clé de l'entreprise + accord du propriétaire ; ouvert à tout le personnel. */
export type ChatAvailability = 'loading' | 'active' | 'no_key' | 'owner_can_enable' | 'ask_owner';

export function chatAvailability(settings: OcrSettings, isLoading: boolean, role: AgencyRole | null | undefined): ChatAvailability {
  if (isLoading) return 'loading';
  if (settings.chatEnabled) return 'active';
  if (!settings.cloudAvailable) return 'no_key';
  return role === 'owner' ? 'owner_can_enable' : 'ask_owner';
}

import type { MaintenanceType } from './types';

type T = (key: string, params?: Record<string, unknown>) => string;

/** Nom affiché d'un entretien : « Courroie de distribution » pour un « Autre » nommé, sinon le nom du type (« Vidange »). */
export function maintenanceLabel(item: { type: MaintenanceType; titre?: string | null }, t: T): string {
  const titre = item.type === 'autre' ? item.titre?.trim() : '';
  return titre ? titre : t(`maintenance.types.${item.type}`);
}

/** Forme « dans une phrase » (« la vidange », « l'entretien « Courroie » ») : pour « Avez-vous fait … ? ». */
export function maintenancePhrase(item: { type: MaintenanceType; titre?: string | null }, t: T): string {
  const titre = item.type === 'autre' ? item.titre?.trim() : '';
  return titre ? t('notifications.maintenance.named', { name: titre }) : t(`notifications.maintenance.${item.type}`);
}

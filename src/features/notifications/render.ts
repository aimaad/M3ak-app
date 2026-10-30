import type { AppNotification, NotificationLinkType, NotificationSeverity } from './types';
import { M3akPalette } from '@/constants/theme';

type Translate = (key: string, options?: Record<string, unknown>) => string;

export type NotificationView = {
  title: string;
  body: string;
  /** Nom de la filiale ; absent quand l'agence n'en a pas. */
  branch: string | null;
  /** Numéro à appeler (client) quand la notification en contient un. */
  phone: string | null;
};

/** i18next renvoie la clé elle-même quand elle n'existe pas : on prend alors le texte de secours. */
function translateOr(t: Translate, key: string, fallbackKey: string, options?: Record<string, unknown>): string {
  const text = t(key, options);
  return text === key ? t(fallbackKey, options) : text;
}

/** Variables des modèles ; une valeur absente s'affiche « — » (i18next la remplacerait sinon par du vide). */
const VARIABLES = ['customer', 'phone', 'vehicle', 'plate', 'amount', 'date', 'end', 'start', 'count', 'name', 'rental', 'contract', 'maintenance'];

const DATE_KEYS = ['date', 'end', 'start'];

function formatDay(value: unknown, language: string): string {
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value ?? '');
  return date.toLocaleDateString(language === 'ar' ? 'ar-MA' : 'fr-FR', { day: '2-digit', month: 'short', timeZone: 'Africa/Casablanca' });
}

/** Texte d'une notification dans la langue de l'utilisateur ; une valeur manquante devient « — », jamais « undefined ». */
export function notificationView(item: Pick<AppNotification, 'kind' | 'params'>, t: Translate, language: string): NotificationView {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(item.params ?? {})) {
    if (value == null) continue;
    params[key] = DATE_KEYS.includes(key) ? formatDay(value, language) : String(value);
  }
  if (typeof item.params?.maintenance === 'string') {
    params.maintenance = translateOr(t, `notifications.maintenance.${item.params.maintenance}`, 'notifications.maintenance.autre');
  }
  const variables = { ...Object.fromEntries(VARIABLES.map((name) => [name, '—'])), ...params };
  const fill = (key: string) => translateOr(t, `notifications.kinds.${item.kind}.${key}`, `notifications.fallback.${key}`, variables);
  const branch = typeof item.params?.branch === 'string' && item.params.branch.trim() ? item.params.branch : null;
  const phone = typeof item.params?.phone === 'string' && item.params.phone.trim() ? item.params.phone : null;
  return { title: fill('title'), body: fill('body'), branch, phone };
}

/** Écran à ouvrir quand on touche la notification. */
export function notificationRoute(linkType: NotificationLinkType | null, linkId: string | null): { pathname: string; params?: Record<string, string> } | null {
  switch (linkType) {
    case 'rental':
      return linkId ? { pathname: '/locations/[id]', params: { id: linkId } } : { pathname: '/locations' };
    case 'contract':
      return linkId ? { pathname: '/contrats/[id]', params: { id: linkId } } : { pathname: '/contrats' };
    case 'vehicle':
      return linkId ? { pathname: '/flotte/[id]', params: { id: linkId } } : { pathname: '/flotte' };
    case 'customer':
      return linkId ? { pathname: '/clients/[id]', params: { id: linkId } } : { pathname: '/clients' };
    case 'maintenance':
      return { pathname: '/maintenance' };
    case 'team':
      return { pathname: '/equipe' };
    default:
      return null;
  }
}

/** « Il y a 3 h » : minutes, heures, puis jours. */
export function timeAgo(iso: string, now: Date, t: Translate): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return t('notifications.ago.now');
  if (minutes < 60) return t('notifications.ago.minutes', { count: minutes });
  if (minutes < 60 * 24) return t('notifications.ago.hours', { count: Math.floor(minutes / 60) });
  return t('notifications.ago.days', { count: Math.floor(minutes / (60 * 24)) });
}

export const SEVERITY_COLORS: Record<NotificationSeverity, { bar: string; background: string }> = {
  info: { bar: M3akPalette.mauve, background: '#F3EEFF' },
  warning: { bar: '#F59E0B', background: '#FEF3C7' },
  urgent: { bar: '#DC2626', background: '#FEE2E2' },
};

export const CATEGORY_ICONS = {
  rental: 'car-outline',
  reminder: 'alarm-outline',
  payment: 'cash-outline',
  contract: 'document-text-outline',
  inspection: 'camera-outline',
  maintenance: 'construct-outline',
  team: 'people-outline',
  customer: 'person-outline',
} as const;

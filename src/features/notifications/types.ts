export const NOTIFICATION_CATEGORIES = ['rental', 'reminder', 'payment', 'contract', 'inspection', 'maintenance', 'team', 'customer'] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];
export type NotificationSeverity = 'info' | 'warning' | 'urgent';
export type NotificationLinkType = 'rental' | 'contract' | 'vehicle' | 'customer' | 'maintenance' | 'team';

export type AppNotification = {
  id: string;
  agencyId: string;
  kind: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  params: Record<string, unknown>;
  linkType: NotificationLinkType | null;
  linkId: string | null;
  createdAt: string;
};

export type NotificationPreferences = {
  enabled: boolean;
  pushEnabled: boolean;
  mutedCategories: NotificationCategory[];
  /** Langue dans laquelle le serveur écrit les notifications push de cet utilisateur. */
  locale?: 'fr' | 'ar';
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = { enabled: true, pushEnabled: true, mutedCategories: [] };

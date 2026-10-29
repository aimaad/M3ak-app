import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/features/auth/session-context';
import { useLanguage } from '@/i18n/use-language';

import {
  dismissAllNotifications,
  restoreNotifications, dismissNotification,
  getNotificationPreferences,
  listNotifications,
  saveNotificationPreferences,
} from './api';
import { DEFAULT_NOTIFICATION_PREFERENCES, type AppNotification, type NotificationPreferences } from './types';

const REFRESH_MS = 60_000;

export function notificationsKey(agencyId: string | undefined) {
  return ['notifications', agencyId] as const;
}

/** Liste des notifications ; rafraîchie chaque minute pour que la cloche reste à jour. */
export function useNotifications(agencyId: string | undefined) {
  return useQuery({
    queryKey: notificationsKey(agencyId),
    enabled: !!agencyId,
    queryFn: () => listNotifications(agencyId as string),
    refetchInterval: REFRESH_MS,
  });
}

export function useDismissNotification(agencyId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dismissNotification(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: notificationsKey(agencyId) });
      const previous = queryClient.getQueryData<AppNotification[]>(notificationsKey(agencyId));
      queryClient.setQueryData<AppNotification[]>(notificationsKey(agencyId), (list) => (list ?? []).filter((item) => item.id !== id));
      return { previous };
    },
    onError: (_error, _id, context) => queryClient.setQueryData(notificationsKey(agencyId), context?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationsKey(agencyId) }),
  });
}

export function useRestoreNotifications(agencyId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => restoreNotifications(ids),
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationsKey(agencyId) }),
  });
}

export function useDismissAllNotifications(agencyId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => dismissAllNotifications(agencyId as string),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: notificationsKey(agencyId) });
      const previous = queryClient.getQueryData<AppNotification[]>(notificationsKey(agencyId));
      queryClient.setQueryData<AppNotification[]>(notificationsKey(agencyId), []);
      return { previous };
    },
    onError: (_error, _vars, context) => queryClient.setQueryData(notificationsKey(agencyId), context?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationsKey(agencyId) }),
  });
}

export function useNotificationPreferences(agencyId: string | undefined) {
  const { session } = useSession();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['notification-preferences', agencyId, userId],
    enabled: !!agencyId && !!userId,
    queryFn: () => getNotificationPreferences(agencyId as string, userId as string),
  });
}

export function useSaveNotificationPreferences(agencyId: string | undefined) {
  const queryClient = useQueryClient();
  const { session } = useSession();
  const { language } = useLanguage();
  const userId = session?.user.id;
  const key = ['notification-preferences', agencyId, userId];
  return useMutation({
    mutationFn: (prefs: NotificationPreferences) =>
      saveNotificationPreferences(agencyId as string, userId as string, prefs, language === 'ar' ? 'ar' : 'fr'),
    onMutate: async (prefs) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<NotificationPreferences>(key) ?? DEFAULT_NOTIFICATION_PREFERENCES;
      queryClient.setQueryData(key, prefs);
      return { previous };
    },
    onError: (_error, _prefs, context) => queryClient.setQueryData(key, context?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}

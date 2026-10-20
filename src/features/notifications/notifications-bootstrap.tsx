import { useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { useMyAgency } from '@/features/agency/hooks';
import { useSession } from '@/features/auth/session-context';
import { useLanguage } from '@/i18n/use-language';

import { dismissNotification, registerPushToken } from './api';
import { useNotificationPreferences, useSaveNotificationPreferences } from './hooks';
import { configureForegroundNotifications, getPushToken, isPushSupported } from './push';
import { notificationRoute } from './render';
import type { NotificationLinkType } from './types';

function openFromPush(data: Record<string, unknown> | undefined, onDone: () => void) {
  if (!data) return;
  if (typeof data.notificationId === 'string') dismissNotification(data.notificationId).catch(() => {}).finally(onDone);
  const route = notificationRoute((data.linkType as NotificationLinkType | null) ?? null, (data.linkId as string | null) ?? null);
  router.push((route ?? { pathname: '/notifications' }) as never);
}

/**
 * Invisible : enregistre le téléphone pour les notifications push, tient la langue des notifications à jour
 * et ouvre le bon écran quand on touche une notification.
 */
function Listeners({ userId }: { userId: string }) {
  const agencyQuery = useMyAgency();
  const agencyId = agencyQuery.data?.agencyId;
  const prefsQuery = useNotificationPreferences(agencyId);
  const savePrefs = useSaveNotificationPreferences(agencyId);
  const queryClient = useQueryClient();
  const { language } = useLanguage();
  const prefs = prefsQuery.data;
  const syncedLocale = useRef<string | null>(null);

  useEffect(() => {
    configureForegroundNotifications();
  }, []);

  // Jeton du téléphone, tant que les notifications (et le push) sont activés.
  useEffect(() => {
    if (!userId || !agencyId || !prefs?.enabled || !prefs.pushEnabled) return;
    let cancelled = false;
    getPushToken().then((token) => {
      if (token && !cancelled) registerPushToken(token, userId, Platform.OS).catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, [userId, agencyId, prefs?.enabled, prefs?.pushEnabled]);

  // Le serveur écrit les push dans la langue de l'utilisateur : on la lui communique quand elle change.
  useEffect(() => {
    if (!prefs || !agencyId || !userId) return;
    const wanted = language === 'ar' ? 'ar' : 'fr';
    if ((prefs.locale ?? 'fr') === wanted || syncedLocale.current === wanted) return;
    syncedLocale.current = wanted;
    savePrefs.mutate({ ...prefs, locale: wanted });
  }, [prefs, agencyId, userId, language, savePrefs]);

  useEffect(() => {
    if (!isPushSupported()) return;
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['notifications'] });
    const received = Notifications.addNotificationReceivedListener(refresh);
    const tapped = Notifications.addNotificationResponseReceivedListener((response) =>
      openFromPush(response.notification.request.content.data, refresh)
    );
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) openFromPush(response.notification.request.content.data, refresh);
      })
      .catch(() => {});
    return () => {
      received.remove();
      tapped.remove();
    };
  }, [queryClient]);

  return null;
}

export function NotificationsBootstrap() {
  const { session } = useSession();
  return session ? <Listeners userId={session.user.id} /> : null;
}

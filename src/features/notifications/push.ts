import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { removePushToken } from './api';

/** À la déconnexion : ce téléphone ne doit plus recevoir les notifications de la personne qui part. */
export async function unregisterThisDevice(): Promise<void> {
  try {
    if (!isPushSupported()) return;
    if (!(await Notifications.getPermissionsAsync()).granted) return;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return;
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    await removePushToken(data);
  } catch {
    // Sans importance : le serveur retire de toute façon les téléphones qui ne répondent plus.
  }
}

/** Expo Go ne reçoit plus les notifications push : il faut l'application installée (development build / store). */
export function isPushSupported(): boolean {
  // Pas de push dans le navigateur : les notifications restent consultables dans l'application.
  return Platform.OS !== 'web' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient && Device.isDevice;
}

/** Affiche aussi la notification quand l'application est ouverte. */
export function configureForegroundNotifications(): void {
  if (!isPushSupported()) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

/**
 * Demande l'autorisation et renvoie le jeton Expo Push de ce téléphone (null si impossible : Expo Go, simulateur, refus).
 * Ne lève jamais d'erreur : les notifications dans l'application fonctionnent sans push.
 */
export async function getPushToken(): Promise<string | null> {
  try {
    if (!isPushSupported()) return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', { name: 'M3ak', importance: Notifications.AndroidImportance.DEFAULT });
      await Notifications.setNotificationChannelAsync('urgent', { name: 'M3ak urgent', importance: Notifications.AndroidImportance.HIGH });
    }

    const existing = await Notifications.getPermissionsAsync();
    const granted = existing.granted || (await Notifications.requestPermissionsAsync()).granted;
    if (!granted) return null;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return null;
    return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch {
    return null;
  }
}

import { router } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { PressableCard } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { customerDocumentAlerts } from '@/features/customers/document-alerts';
import { useCustomers } from '@/features/customers/hooks';
import { vehicleDocumentAlerts } from '@/features/vehicles/document-alerts';
import { useVehicles } from '@/features/vehicles/hooks';
import type { ExpiryUrgency } from '@/lib/expiry';
import { useLanguage } from '@/i18n/use-language';

import { HomeListScreen } from '@/features/dashboard/home-list-screen';

type Item = { key: string; name: string; expiresAt: string; urgency: Exclude<ExpiryUrgency, 'ok'>; href: `/clients/${string}` | `/flotte/${string}` };

/** Documents (clients et véhicules) expirés ou bientôt expirés : un toucher ouvre la fiche pour mettre à jour. */
export default function DocumentsScreen() {
  const { t, language } = useLanguage();
  const customers = useCustomers();
  const vehicles = useVehicles();
  const items: Item[] = useMemo(() => {
    const fromCustomers = customerDocumentAlerts(customers.data ?? []).map((a) => ({
      key: `c-${a.customerId}-${a.type}`,
      name: a.customerName,
      expiresAt: a.expiresAt,
      urgency: a.urgency,
      href: `/clients/${a.customerId}` as const,
    }));
    const fromVehicles = vehicleDocumentAlerts(vehicles.data ?? []).map((a) => ({
      key: `v-${a.vehicleId}-${a.type}`,
      name: a.vehicleLabel,
      expiresAt: a.expiresAt,
      urgency: a.urgency,
      href: `/flotte/${a.vehicleId}` as const,
    }));
    return [...fromCustomers, ...fromVehicles].sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
  }, [customers.data, vehicles.data]);
  const locale = language === 'ar' ? 'ar-MA' : 'fr-FR';

  return (
    <HomeListScreen
      title={t('accueil.home.lists.documents.title')}
      data={items}
      loading={customers.isLoading || vehicles.isLoading}
      emptyLabel={t('accueil.home.lists.documents.empty')}
      keyOf={(item) => item.key}
      renderItem={(item) => (
        <PressableCard onPress={() => router.push(item.href)} className="gap-0.5">
          <ThemedText type="smallBold" numberOfLines={1}>
            {item.name}
          </ThemedText>
          <View>
            <ThemedText type="small" themeColor={item.urgency === 'expire' ? 'danger' : 'warning'}>
              {t(item.urgency === 'expire' ? 'accueil.home.lists.documents.expired' : 'accueil.home.lists.documents.soon', {
                date: new Date(item.expiresAt).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' }),
              })}
            </ThemedText>
          </View>
        </PressableCard>
      )}
    />
  );
}

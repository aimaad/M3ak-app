import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { SectionTabs } from '@/components/section-tabs';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CustomerCard } from '@/features/customers/customer-card';
import { useCustomers } from '@/features/customers/hooks';
import { searchCustomers } from '@/features/customers/search';
import type { Customer } from '@/features/customers/types';
import { isRTL } from '@/i18n';
import { useLanguage } from '@/i18n/use-language';

const EMPTY_CUSTOMERS: Customer[] = [];

export default function ClientsScreen() {
  const { t, language } = useLanguage();
  const fabSideClass = isRTL(language) ? 'left-6' : 'right-6';
  const customersQuery = useCustomers();
  const [search, setSearch] = useState('');

  const customers = customersQuery.data ?? EMPTY_CUSTOMERS;
  const filtered = useMemo(() => searchCustomers(customers, search), [customers, search]);

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader
          title={t('clients.title')}
          subtitle={t('clients.subtitle', { count: customers.length })}
        />

        <SectionTabs current="clients" />

        <View className="px-6 pb-4">
          <TextField placeholder={t('clients.searchPlaceholder')} value={search} onChangeText={setSearch} />
        </View>

        {customersQuery.isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#1f5eff" />
            <ThemedText type="small" themeColor="textSecondary" className="mt-2">
              {t('clients.loading')}
            </ThemedText>
          </View>
        ) : customersQuery.isError ? (
          <View className="flex-1 items-center justify-center px-8">
            <ThemedText type="default" themeColor="textSecondary" className="text-center">
              {t('clients.loadError')}
            </ThemedText>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            contentContainerClassName="gap-3 px-6 pb-28"
            renderItem={({ item }) => (
              <CustomerCard customer={item} onPress={() => router.push(`/clients/${item.id}`)} />
            )}
            ListEmptyComponent={
              <View className="items-center pt-12">
                <ThemedText type="default" themeColor="textSecondary">
                  {t('clients.empty')}
                </ThemedText>
              </View>
            }
          />
        )}

        <Pressable
          onPress={() => router.push('/clients/nouveau')}
          className={`absolute bottom-6 ${fabSideClass} flex-row items-center gap-2 rounded-full bg-[#1f5eff] px-5 py-4`}
        >
          <ThemedText type="smallBold" style={{ color: '#ffffff' }}>
            {`+ ${t('clients.addClient')}`}
          </ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

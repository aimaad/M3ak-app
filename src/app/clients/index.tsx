import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomTabBar } from '@/components/bottom-tab-bar';
import { ScreenHeader } from '@/components/screen-header';
import { TextField } from '@/components/text-field';
import { Pager } from '@/components/pager';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CustomerCard } from '@/features/customers/customer-card';
import {
  countActive,
  countArchived,
  countExpiringSoonDocuments,
  DEFAULT_CUSTOMER_FILTERS,
  filterCustomers,
  type CustomerFilters,
} from '@/features/customers/filters';
import { useCustomers } from '@/features/customers/hooks';
import { CUSTOMER_TYPES } from '@/features/customers/types';
import type { Customer, CustomerType } from '@/features/customers/types';
import { isRTL } from '@/i18n';
import { usePagination } from '@/lib/pagination';
import { useLanguage } from '@/i18n/use-language';

const EMPTY_CUSTOMERS: Customer[] = [];

function KpiTile({ label, value }: { label: string; value: number }) {
  return (
    <View className="min-w-[130px] gap-1 rounded-3xl border border-[#E4DCF5] bg-white px-4 py-3">
      <ThemedText type="title" themeColor="primary">
        {value}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

export default function ClientsScreen() {
  const { t, language } = useLanguage();
  const fabSideClass = isRTL(language) ? 'left-6' : 'right-6';
  const customersQuery = useCustomers();
  const [filters, setFilters] = useState<CustomerFilters>(DEFAULT_CUSTOMER_FILTERS);
  const [showFilters, setShowFilters] = useState(false);

  const customers = customersQuery.data ?? EMPTY_CUSTOMERS;
  const active = useMemo(() => countActive(customers), [customers]);
  const archived = useMemo(() => countArchived(customers), [customers]);
  const expiringDocs = useMemo(() => countExpiringSoonDocuments(customers), [customers]);
  const filtered = useMemo(() => filterCustomers(customers, filters), [customers, filters]);
  const pagination = usePagination(filtered, filters);

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader title={t('clients.title')} subtitle={t('clients.subtitle', { count: active })} />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-6 pb-3">
          <KpiTile label={t('clients.kpi.active')} value={active} />
          <KpiTile label={t('clients.kpi.archived')} value={archived} />
          <KpiTile label={t('clients.kpi.docsExpirant')} value={expiringDocs} />
        </ScrollView>

        <View className="px-6 pb-3">
          <TextField
            placeholder={t('clients.searchPlaceholder')}
            value={filters.query}
            onChangeText={(v) => setFilters((prev) => ({ ...prev, query: v }))}
          />
        </View>

        <View className="flex-row items-center justify-between px-6 pb-4">
          <Pressable onPress={() => setShowFilters((prev) => !prev)}>
            <ThemedText type="small" themeColor="primary">
              {showFilters ? t('flotte.hideFilters') : t('flotte.moreFilters')}
            </ThemedText>
          </Pressable>
          <Pressable onPress={() => setFilters((prev) => ({ ...prev, includeArchived: !prev.includeArchived }))}>
            <ThemedText type="small" themeColor={filters.includeArchived ? 'primary' : 'textSecondary'}>
              {filters.includeArchived ? t('flotte.showingArchived') : t('flotte.showArchived')}
            </ThemedText>
          </Pressable>
        </View>

        {showFilters ? (
          <View className="gap-1.5 px-6 pb-4">
            <ThemedText type="small" themeColor="textSecondary">
              {t('customer.sections.type')}
            </ThemedText>
            <View className="flex-row flex-wrap gap-2">
              <Pressable
                onPress={() => setFilters((prev) => ({ ...prev, typeClient: 'tous' }))}
                className={`rounded-full border px-4 py-2 ${
                  filters.typeClient === 'tous' ? 'border-[#211A2E] bg-[#211A2E]' : 'border-[#E4DCF5] bg-white'
                }`}
              >
                <ThemedText type="small" style={{ color: filters.typeClient === 'tous' ? '#ffffff' : '#211A2E' }}>
                  {t('flotte.status.tous')}
                </ThemedText>
              </Pressable>
              {CUSTOMER_TYPES.map((type: CustomerType) => (
                <Pressable
                  key={type}
                  onPress={() => setFilters((prev) => ({ ...prev, typeClient: type }))}
                  className={`rounded-full border px-4 py-2 ${
                    filters.typeClient === type ? 'border-[#211A2E] bg-[#211A2E]' : 'border-[#E4DCF5] bg-white'
                  }`}
                >
                  <ThemedText type="small" style={{ color: filters.typeClient === type ? '#ffffff' : '#211A2E' }}>
                    {t(`customer.type.${type}`)}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {customersQuery.isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#7C3AED" />
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
            data={pagination.items}
            keyExtractor={(item) => item.id}
            contentContainerClassName="gap-3 px-6 pb-32"
            refreshControl={
              <RefreshControl
                refreshing={customersQuery.isFetching}
                onRefresh={() => void customersQuery.refetch()}
                tintColor="#7C3AED"
              />
            }
            renderItem={({ item }) => (
              <CustomerCard customer={item} onPress={() => router.push(`/clients/${item.id}`)} />
            )}
            ListFooterComponent={<Pager page={pagination.page} pageCount={pagination.pageCount} onChange={pagination.setPage} />}
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
          className={`absolute bottom-24 ${fabSideClass} flex-row items-center gap-2 rounded-full bg-[#7C3AED] px-5 py-4`}
        >
          <ThemedText type="smallBold" style={{ color: '#ffffff' }}>
            {`+ ${t('clients.addClient')}`}
          </ThemedText>
        </Pressable>

        <BottomTabBar current="clients" />
      </SafeAreaView>
    </ThemedView>
  );
}

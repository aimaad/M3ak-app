import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
import { DataTable, type DataTableColumn } from '@/components/data-table';
import { useDesktopLayout } from '@/hooks/use-desktop-layout';
import { isRTL } from '@/i18n';
import { usePagination } from '@/lib/pagination';
import { useLanguage } from '@/i18n/use-language';
import { M3akPalette } from '@/constants/theme';

const EMPTY_CUSTOMERS: Customer[] = [];

function KpiTile({ label, value }: { label: string; value: number }) {
  return (
    <View className="min-w-[130px] gap-1 rounded-3xl border border-line bg-white px-4 py-3">
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
  const isDesktop = useDesktopLayout();
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

  const columns: DataTableColumn<Customer>[] = [
    {
      key: 'name',
      label: t('customer.fields.nomComplet'),
      flex: 2,
      render: (c) => (
        <ThemedText type="smallBold" numberOfLines={1}>
          {c.nomComplet}
        </ThemedText>
      ),
    },
    { key: 'type', label: t('customer.sections.type'), render: (c) => <ThemedText type="small">{t(`customer.type.${c.typeClient}`)}</ThemedText> },
    { key: 'phone', label: t('customer.fields.telephone'), render: (c) => <ThemedText type="small">{c.telephone ?? '—'}</ThemedText> },
    {
      key: 'email',
      label: t('customer.fields.email'),
      flex: 1.5,
      render: (c) => (
        <ThemedText type="small" numberOfLines={1}>
          {c.email ?? '—'}
        </ThemedText>
      ),
    },
    { key: 'cin', label: t('customer.fields.cin'), render: (c) => <ThemedText type="small">{c.cinOuPasseport ?? '—'}</ThemedText> },
    { key: 'city', label: t('customer.fields.ville'), render: (c) => <ThemedText type="small">{c.ville ?? '—'}</ThemedText> },
    {
      key: 'status',
      label: t('desktop.status'),
      render: (c) => (
        <ThemedText type="small" themeColor={c.archivedAt ? 'textSecondary' : 'primary'}>
          {c.archivedAt ? t('customer.archivedBadge') : t('desktop.active')}
        </ThemedText>
      ),
    },
  ];

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="w-full flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader title={t('clients.title')} subtitle={t('clients.subtitle', { count: active })} />

        <ScrollView horizontal className="grow-0 shrink-0" showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-6 pb-3">
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
                  filters.typeClient === 'tous' ? 'border-ink bg-ink' : 'border-line bg-white'
                }`}
              >
                <ThemedText type="small" style={{ color: filters.typeClient === 'tous' ? '#ffffff' : M3akPalette.ink }}>
                  {t('flotte.status.tous')}
                </ThemedText>
              </Pressable>
              {CUSTOMER_TYPES.map((type: CustomerType) => (
                <Pressable
                  key={type}
                  onPress={() => setFilters((prev) => ({ ...prev, typeClient: type }))}
                  className={`rounded-full border px-4 py-2 ${
                    filters.typeClient === type ? 'border-ink bg-ink' : 'border-line bg-white'
                  }`}
                >
                  <ThemedText type="small" style={{ color: filters.typeClient === type ? '#ffffff' : M3akPalette.ink }}>
                    {t(`customer.type.${type}`)}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {customersQuery.isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={M3akPalette.mauve} />
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
          isDesktop ? (
            <ScrollView contentContainerClassName="px-6 pb-24">
              <DataTable
                columns={columns}
                rows={pagination.items}
                rowKey={(item) => item.id}
                onRowPress={(item) => router.push(`/clients/${item.id}`)}
                exportCsv={{ filename: 'clients', rows: filtered, cells: (c) => [c.nomComplet, t(`customer.type.${c.typeClient}`), c.telephone, c.email, c.cinOuPasseport, c.ville, c.archivedAt ? t('customer.archivedBadge') : t('desktop.active')] }}
                emptyLabel={customers.length === 0 ? t('clients.emptyNone') : t('clients.empty')}
              />
              <Pager page={pagination.page} pageCount={pagination.pageCount} onChange={pagination.setPage} />
            </ScrollView>
          ) : (
          <FlatList
            data={pagination.items}
            keyExtractor={(item) => item.id}
            contentContainerClassName="gap-3 px-6 pb-24"
            refreshControl={
              <RefreshControl
                refreshing={customersQuery.isFetching}
                onRefresh={() => void customersQuery.refetch()}
                tintColor={M3akPalette.mauve}
              />
            }
            renderItem={({ item }) => (
              <CustomerCard customer={item} onPress={() => router.push(`/clients/${item.id}`)} />
            )}
            ListFooterComponent={<Pager page={pagination.page} pageCount={pagination.pageCount} onChange={pagination.setPage} />}
            ListEmptyComponent={
              <View className="items-center pt-12">
                <ThemedText type="default" themeColor="textSecondary">
                  {customers.length === 0 ? t('clients.emptyNone') : t('clients.empty')}
                </ThemedText>
              </View>
            }
          />
          )
        )}

        <Pressable
          onPress={() => router.push('/clients/nouveau')}
          className={`absolute bottom-6 ${fabSideClass} flex-row items-center gap-2 rounded-full bg-brand px-5 py-4`}
        >
          <ThemedText type="smallBold" style={{ color: '#ffffff' }}>
            {`+ ${t('clients.addClient')}`}
          </ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

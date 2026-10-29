import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableCard } from '@/components/card';
import { ScreenHeader } from '@/components/screen-header';
import { TextField } from '@/components/text-field';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import { Pager } from '@/components/pager';
import { useDesktopLayout } from '@/hooks/use-desktop-layout';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ContractStatusBadge } from '@/features/contracts/contract-status-badge';
import { useContracts } from '@/features/contracts/hooks';
import { CONTRACT_STATUSES } from '@/features/contracts/types';
import type { Contract, ContractStatus } from '@/features/contracts/types';
import { usePagination } from '@/lib/pagination';
import { useLanguage } from '@/i18n/use-language';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

export default function ContratsScreen() {
  const { t } = useLanguage();
  const isDesktop = useDesktopLayout();
  const contractsQuery = useContracts();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ContractStatus | 'tous'>('tous');

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (contractsQuery.data ?? []).filter((c: Contract) => {
      if (statusFilter !== 'tous' && c.statut !== statusFilter) return false;
      if (!normalized) return true;
      return (
        c.numero.toLowerCase().includes(normalized) ||
        c.customerNom.toLowerCase().includes(normalized) ||
        c.vehicleImmatriculation.toLowerCase().includes(normalized)
      );
    });
  }, [contractsQuery.data, query, statusFilter]);
  const pagination = usePagination(filtered, `${query}|${statusFilter}`);

  const columns: DataTableColumn<Contract>[] = [
    { key: 'number', label: t('desktop.number'), render: (c) => <ThemedText type="smallBold">{c.numero}</ThemedText> },
    {
      key: 'customer',
      label: t('desktop.customer'),
      flex: 1.5,
      render: (c) => (
        <ThemedText type="small" numberOfLines={1}>
          {c.customerNom}
        </ThemedText>
      ),
    },
    {
      key: 'vehicle',
      label: t('desktop.vehicle'),
      flex: 1.5,
      render: (c) => (
        <ThemedText type="small" numberOfLines={1}>
          {c.vehicleMarque} {c.vehicleModele} · {c.vehicleImmatriculation}
        </ThemedText>
      ),
    },
    {
      key: 'period',
      label: t('desktop.period'),
      flex: 1.5,
      render: (c) => (
        <ThemedText type="small">
          {formatDate(c.dateDebutPrevue)} → {formatDate(c.dateFinPrevue)}
        </ThemedText>
      ),
    },
    { key: 'status', label: t('desktop.status'), render: (c) => <ContractStatusBadge status={c.statut} /> },
  ];

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="w-full flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader title={t('contract.listTitle')} subtitle={t('contract.listSubtitle', { count: contractsQuery.data?.length ?? 0 })} showBack />

        <View className="px-6 pb-3">
          <TextField placeholder={t('contract.searchPlaceholder')} value={query} onChangeText={setQuery} />
        </View>

        <View className="flex-row flex-wrap gap-2 px-6 pb-4">
          <Pressable
            onPress={() => setStatusFilter('tous')}
            className={`rounded-full border px-4 py-2 ${statusFilter === 'tous' ? 'border-[#211A2E] bg-[#211A2E]' : 'border-[#E4DCF5] bg-white'}`}
          >
            <ThemedText type="small" style={{ color: statusFilter === 'tous' ? '#ffffff' : '#211A2E' }}>
              {t('flotte.status.tous')}
            </ThemedText>
          </Pressable>
          {CONTRACT_STATUSES.map((status) => (
            <Pressable
              key={status}
              onPress={() => setStatusFilter(status)}
              className={`rounded-full border px-4 py-2 ${statusFilter === status ? 'border-[#211A2E] bg-[#211A2E]' : 'border-[#E4DCF5] bg-white'}`}
            >
              <ThemedText type="small" style={{ color: statusFilter === status ? '#ffffff' : '#211A2E' }}>
                {t(`contract.status.${status}`)}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        {contractsQuery.isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#7C3AED" />
          </View>
        ) : contractsQuery.isError ? (
          <View className="flex-1 items-center justify-center px-8">
            <ThemedText type="default" themeColor="textSecondary" className="text-center">
              {t('contract.loadError')}
            </ThemedText>
          </View>
        ) : (
          isDesktop ? (
            <ScrollView contentContainerClassName="px-6 pb-10">
              <DataTable
                columns={columns}
                rows={pagination.items}
                rowKey={(item) => item.id}
                onRowPress={(item) => router.push(`/contrats/${item.id}`)}
                exportCsv={{ filename: 'contrats', rows: filtered, cells: (c) => [c.numero, c.customerNom, `${c.vehicleMarque} ${c.vehicleModele} ${c.vehicleImmatriculation}`, c.dateDebutPrevue.slice(0, 10) + ' → ' + c.dateFinPrevue.slice(0, 10), t(`contract.status.${c.statut}`)] }}
                emptyLabel={t('contract.empty')}
              />
              <Pager page={pagination.page} pageCount={pagination.pageCount} onChange={pagination.setPage} />
            </ScrollView>
          ) : (
          <FlatList
            data={pagination.items}
            keyExtractor={(item) => item.id}
            contentContainerClassName="gap-3 px-6 pb-10"
            renderItem={({ item }) => (
              <PressableCard onPress={() => router.push(`/contrats/${item.id}`)} className="gap-2">
                <View className="flex-row items-start justify-between gap-2">
                  <View className="flex-1 gap-1">
                    <ThemedText type="smallBold">{item.numero}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {item.customerNom} · {item.vehicleImmatriculation}
                    </ThemedText>
                  </View>
                  <ContractStatusBadge status={item.statut} />
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatDate(item.dateDebutPrevue)} → {formatDate(item.dateFinPrevue)}
                </ThemedText>
              </PressableCard>
            )}
            ListFooterComponent={<Pager page={pagination.page} pageCount={pagination.pageCount} onChange={pagination.setPage} />}
            ListEmptyComponent={
              <View className="items-center pt-12">
                <ThemedText type="default" themeColor="textSecondary">
                  {t('contract.empty')}
                </ThemedText>
              </View>
            }
          />
          )
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

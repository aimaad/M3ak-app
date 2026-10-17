import * as Sharing from 'expo-sharing';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ChipGroup } from '@/components/chip-group';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { M3akPalette } from '@/constants/theme';
import { useAgencyMembers, useMyAgency } from '@/features/agency/hooks';
import { listAuditEntriesForExport } from '@/features/audit/api';
import { generateAuditPdf } from '@/features/audit/audit-pdf';
import { actorLabel, describeAuditEntry } from '@/features/audit/describe';
import { toAuditQuery, useActivitySummary, useAuditEntries } from '@/features/audit/hooks';
import { AUDIT_CATEGORIES, AUDIT_PERIODS, type AuditCategory, type AuditFilters, type AuditPeriod } from '@/features/audit/types';
import { useLanguage } from '@/i18n/use-language';

function formatDateTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Traçabilité : réservée au propriétaire (écran ET base de données). Filtres, synthèse par personne, export PDF. */
export default function JournalScreen() {
  const { t, language } = useLanguage();
  const locale = language === 'ar' ? 'ar' : 'fr-FR';
  const agencyQuery = useMyAgency();
  const agencyId = agencyQuery.data?.agencyId;
  const membersQuery = useAgencyMembers(agencyId);

  const [filters, setFilters] = useState<AuditFilters>({ period: '7d', actorId: null, category: null });
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const isOwner = agencyQuery.data?.role === 'owner';
  const entriesQuery = useAuditEntries(isOwner ? agencyId : undefined, filters);
  const summaryQuery = useActivitySummary(isOwner ? agencyId : undefined, filters);

  if (agencyQuery.data && !isOwner) {
    return <Redirect href="/entreprise" />;
  }

  const entries = entriesQuery.data?.pages.flat() ?? [];
  const people = (membersQuery.data ?? []).filter((m) => m.userId);
  const nameOf = (userId: string) => people.find((m) => m.userId === userId)?.nomComplet?.trim() || t('journal.unknownActor');

  const filterLabels = [
    t(`journal.period.${filters.period}`),
    filters.actorId ? nameOf(filters.actorId) : t('journal.filters.allEmployees'),
    filters.category ? t(`journal.categories.${filters.category}`) : t('journal.filters.allCategories'),
  ];

  async function handleExport() {
    if (!agencyId || !agencyQuery.data) return;
    setExporting(true);
    setExportError(null);
    try {
      const { entries: all, truncated } = await listAuditEntriesForExport(toAuditQuery(agencyId, filters));
      const uri = await generateAuditPdf({
        agencyName: agencyQuery.data.agencyName,
        entries: all,
        truncated,
        filterLabels,
        generatedBy: agencyQuery.data.memberName ?? t('journal.unknownActor'),
        generatedAt: new Date(),
        language: language === 'ar' ? 'ar' : 'fr',
        t,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: t('journal.pdf.share') });
      }
    } catch {
      setExportError(t('journal.exportError'));
    } finally {
      setExporting(false);
    }
  }

  const header = (
    <View className="gap-4 pb-3">
      <View className="gap-2">
        <ThemedText type="smallBold">{t('journal.period.label')}</ThemedText>
        <ChipGroup<AuditPeriod>
          options={AUDIT_PERIODS}
          selected={filters.period}
          getLabel={(p) => t(`journal.period.${p}`)}
          onSelect={(period) => setFilters((f) => ({ ...f, period }))}
        />
      </View>

      <View className="gap-2">
        <ThemedText type="smallBold">{t('journal.filters.employee')}</ThemedText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <ChipGroup<string>
            options={['all', ...people.map((m) => m.userId)]}
            selected={filters.actorId ?? 'all'}
            getLabel={(id) => (id === 'all' ? t('journal.filters.allEmployees') : nameOf(id))}
            onSelect={(id) => setFilters((f) => ({ ...f, actorId: id === 'all' ? null : id }))}
          />
        </ScrollView>
      </View>

      <View className="gap-2">
        <ThemedText type="smallBold">{t('journal.filters.category')}</ThemedText>
        <ChipGroup<AuditCategory | 'all'>
          options={['all', ...AUDIT_CATEGORIES]}
          selected={filters.category ?? 'all'}
          getLabel={(c) => (c === 'all' ? t('journal.filters.allCategories') : t(`journal.categories.${c}`))}
          onSelect={(c) => setFilters((f) => ({ ...f, category: c === 'all' ? null : c }))}
        />
      </View>

      <View className="gap-2">
        <ThemedText type="smallBold">{t('journal.summary.title')}</ThemedText>
        {summaryQuery.isLoading ? (
          <ActivityIndicator color={M3akPalette.mauve} />
        ) : (summaryQuery.data ?? []).length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            {t('journal.summary.none')}
          </ThemedText>
        ) : (
          (summaryQuery.data ?? []).map((row) => (
            <Card key={row.actorId ?? 'unknown'} padded={false} className="gap-0.5 px-4 py-3">
              <View className="flex-row items-center justify-between gap-2">
                <ThemedText type="smallBold" style={{ flex: 1 }}>
                  {row.actorName || t('journal.unknownActor')}
                  {row.actorRole ? ` · ${t(`equipe.roles.${row.actorRole}`)}` : ''}
                </ThemedText>
                <ThemedText type="smallBold" themeColor="primary">
                  {t('journal.summary.actions', { count: row.total })}
                </ThemedText>
              </View>
              {row.lastAt ? (
                <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11 }}>
                  {t('journal.summary.last', { date: formatDateTime(row.lastAt, locale) })}
                </ThemedText>
              ) : null}
            </Card>
          ))
        )}
      </View>

      <Button label={exporting ? t('journal.exporting') : t('journal.export')} onPress={handleExport} disabled={exporting} loading={exporting} />
      {exportError ? (
        <ThemedText type="small" style={{ color: M3akPalette.danger }}>
          {exportError}
        </ThemedText>
      ) : null}
    </View>
  );

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader title={t('journal.title')} subtitle={t('journal.subtitle')} showBack />

        {agencyQuery.isLoading || entriesQuery.isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={M3akPalette.mauve} />
          </View>
        ) : (
          <FlatList
            data={entries}
            keyExtractor={(entry) => entry.id}
            ListHeaderComponent={header}
            contentContainerClassName="gap-2 px-6 pb-10"
            renderItem={({ item }) => (
              <Card padded={false} className="gap-0.5 px-4 py-3">
                <ThemedText type="small">{describeAuditEntry(item, t)}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11 }}>
                  {`${actorLabel(item, t)} · ${formatDateTime(item.createdAt, locale)}`}
                </ThemedText>
              </Card>
            )}
            ListEmptyComponent={
              <ThemedText type="default" themeColor="textSecondary" className="py-6 text-center">
                {entriesQuery.isError ? t('journal.loadError') : t('journal.empty')}
              </ThemedText>
            }
            ListFooterComponent={
              entriesQuery.hasNextPage ? (
                <Button
                  label={t('journal.loadMore')}
                  variant="ghost"
                  onPress={() => entriesQuery.fetchNextPage()}
                  disabled={entriesQuery.isFetchingNextPage}
                  loading={entriesQuery.isFetchingNextPage}
                />
              ) : null
            }
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

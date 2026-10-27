import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Alert, FlatList, Linking, Pressable, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Pager } from '@/components/pager';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { M3akPalette } from '@/constants/theme';
import { useMyAgency } from '@/features/agency/hooks';
import { useDismissAllNotifications, useDismissNotification, useNotifications } from '@/features/notifications/hooks';
import { CATEGORY_ICONS, notificationRoute, notificationView, SEVERITY_COLORS, timeAgo } from '@/features/notifications/render';
import type { AppNotification } from '@/features/notifications/types';
import { useLanguage } from '@/i18n/use-language';
import { usePagination } from '@/lib/pagination';

export default function NotificationsScreen() {
  const { t, language } = useLanguage();
  const agencyId = useMyAgency().data?.agencyId;
  const query = useNotifications(agencyId);
  const dismiss = useDismissNotification(agencyId);
  const dismissAll = useDismissAllNotifications(agencyId);
  const items = useMemo(() => query.data ?? [], [query.data]);
  const pagination = usePagination(items, items.length === 0);
  const now = new Date();

  function open(item: AppNotification) {
    dismiss.mutate(item.id);
    const route = notificationRoute(item.linkType, item.linkId);
    if (route) router.push(route as never);
  }

  function confirmClearAll() {
    Alert.alert(t('notifications.clearConfirmTitle'), t('notifications.clearConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('notifications.clearAll'), style: 'destructive', onPress: () => dismissAll.mutate() },
    ]);
  }

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader
          title={t('notifications.title')}
          subtitle={items.length > 0 ? t('notifications.total', { count: items.length }) : undefined}
          showBack
          right={
            items.length > 0 ? (
              <Pressable onPress={confirmClearAll} hitSlop={8}>
                <ThemedText type="small" style={{ color: '#DC2626' }}>
                  {t('notifications.clearAll')}
                </ThemedText>
              </Pressable>
            ) : undefined
          }
        />

        {query.isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={M3akPalette.mauve} />
          </View>
        ) : query.isError ? (
          <View className="flex-1 items-center justify-center px-8">
            <ThemedText type="default" themeColor="textSecondary" className="text-center">
              {t('notifications.loadError')}
            </ThemedText>
          </View>
        ) : (
          <FlatList
            data={pagination.items}
            keyExtractor={(item) => item.id}
            contentContainerClassName="gap-3 px-6 pb-10"
            refreshControl={<RefreshControl refreshing={query.isFetching} onRefresh={() => void query.refetch()} tintColor={M3akPalette.mauve} />}
            renderItem={({ item }) => {
              const view = notificationView(item, t, language);
              const colors = SEVERITY_COLORS[item.severity];
              return (
                <Pressable
                  onPress={() => open(item)}
                  className="flex-row gap-3 overflow-hidden rounded-2xl border border-[#E4DCF5] bg-white p-3"
                  accessibilityRole="button"
                >
                  <View className="h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: colors.background }}>
                    <Ionicons name={CATEGORY_ICONS[item.category]} size={20} color={colors.bar} />
                  </View>
                  <View className="flex-1 gap-1">
                    <View className="flex-row items-start justify-between gap-2">
                      <ThemedText type="smallBold" className="flex-1">
                        {view.title}
                      </ThemedText>
                      <Pressable
                        onPress={() => dismiss.mutate(item.id)}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel={t('notifications.dismiss')}
                      >
                        <Ionicons name="close" size={18} color={M3akPalette.mauve} />
                      </Pressable>
                    </View>
                    <ThemedText type="small">{view.body}</ThemedText>
                    {view.branch ? (
                      <View className="self-start rounded-full px-2 py-0.5" style={{ backgroundColor: colors.background }}>
                        <ThemedText type="small" style={{ color: colors.bar, fontSize: 11 }}>
                          {`${t('notifications.branch')} : ${view.branch}`}
                        </ThemedText>
                      </View>
                    ) : null}
                    <View className="flex-row items-center justify-between pt-1">
                      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11 }}>
                        {timeAgo(item.createdAt, now, t)}
                      </ThemedText>
                      {view.phone ? (
                        <Pressable
                          onPress={() => Linking.openURL(`tel:${view.phone}`)}
                          hitSlop={8}
                          className="flex-row items-center gap-1 rounded-full px-3 py-1"
                          style={{ backgroundColor: M3akPalette.mauve }}
                        >
                          <Ionicons name="call" size={13} color="#fff" />
                          <ThemedText type="small" style={{ color: '#fff', fontSize: 12 }}>
                            {t('notifications.call', { phone: view.phone })}
                          </ThemedText>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                </Pressable>
              );
            }}
            ListFooterComponent={<Pager page={pagination.page} pageCount={pagination.pageCount} onChange={pagination.setPage} />}
            ListEmptyComponent={
              <View className="items-center gap-3 px-6 pt-16">
                <Ionicons name="notifications-off-outline" size={44} color={M3akPalette.mauve} />
                <ThemedText type="default" themeColor="textSecondary" className="text-center">
                  {t('notifications.empty')}
                </ThemedText>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

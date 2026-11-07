import type { ReactNode } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Palette } from '@/constants/theme';

/** Squelette des écrans de liste ouverts depuis l'accueil (retards, impayés, véhicules à l'arrêt, documents). */
export function HomeListScreen<T>({
  title,
  subtitle,
  data,
  loading,
  emptyLabel,
  keyOf,
  renderItem,
}: {
  title: string;
  subtitle?: string;
  data: T[];
  loading: boolean;
  emptyLabel: string;
  keyOf: (item: T) => string;
  renderItem: (item: T) => ReactNode;
}) {
  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="w-full flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader title={title} subtitle={subtitle} showBack />
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={Palette.primary} />
          </View>
        ) : (
          <FlatList
            data={data}
            keyExtractor={keyOf}
            contentContainerClassName="gap-3 px-6 pb-10"
            renderItem={({ item }) => <>{renderItem(item)}</>}
            ListEmptyComponent={
              <View className="items-center pt-12">
                <ThemedText type="default" themeColor="textSecondary">
                  {emptyLabel}
                </ThemedText>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

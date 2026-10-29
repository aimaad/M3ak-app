import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ActivityIndicator, Alert, FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { PressableCard } from '@/components/card';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { M3akPalette } from '@/constants/theme';
import { ChatAvatar } from '@/features/chat/chat-bubble';
import { useConversations, useDeleteConversation } from '@/features/chat/hooks';
import { useOcrSettings } from '@/features/ocr/hooks';
import { useLanguage } from '@/i18n/use-language';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

export default function ChatListScreen() {
  const { t } = useLanguage();
  const { chatAvailability, isLoading } = useOcrSettings();
  const conversations = useConversations();
  const remove = useDeleteConversation();
  const active = chatAvailability === 'active';

  function confirmDelete(id: string) {
    Alert.alert(t('chat.deleteTitle'), t('chat.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('chat.delete'), style: 'destructive', onPress: () => remove.mutate(id) },
    ]);
  }

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="w-full flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader title={t('chat.title')} subtitle={t('chat.subtitle')} showBack />

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={M3akPalette.mauve} />
          </View>
        ) : !active ? (
          <View className="flex-1 items-center justify-center gap-3 px-8">
            <Ionicons name="chatbubbles-outline" size={44} color={M3akPalette.mauve} />
            <ThemedText type="default" themeColor="textSecondary" className="text-center">
              {t(chatAvailability === 'owner_can_enable' ? 'chat.inactive.ownerCanEnable' : chatAvailability === 'ask_owner' ? 'chat.inactive.askOwner' : 'chat.inactive.noKey')}
            </ThemedText>
          </View>
        ) : (
          <FlatList
            data={conversations.data ?? []}
            keyExtractor={(item) => item.id}
            contentContainerClassName="gap-3 px-6 pb-10"
            ListHeaderComponent={<Button label={t('chat.newConversation')} icon="sparkles-outline" onPress={() => router.push('/chat/nouveau')} style={{ marginBottom: 8 }} />}
            renderItem={({ item }) => (
              <PressableCard onPress={() => router.push({ pathname: '/chat/[id]', params: { id: item.id } })} className="flex-row items-center gap-3">
                <ChatAvatar size={40} />
                <View className="flex-1 gap-0.5">
                  <ThemedText type="smallBold" numberOfLines={2}>
                    {item.title || t('chat.untitled')}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatDate(item.updatedAt)}
                  </ThemedText>
                </View>
                <Pressable
                  onPress={() => confirmDelete(item.id)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={t('chat.delete')}
                  className="h-11 w-11 items-center justify-center rounded-full bg-[#FEE2E2]"
                >
                  <Ionicons name="trash-outline" size={18} color="#B91C1C" />
                </Pressable>
              </PressableCard>
            )}
            ListEmptyComponent={
              conversations.isLoading ? undefined : (
                <View className="items-center gap-3 px-6 pt-10">
                  <ChatAvatar size={64} />
                  <ThemedText type="smallBold" style={{ fontSize: 18, textAlign: 'center' }}>
                    {t('chat.welcomeTitle')}
                  </ThemedText>
                  <ThemedText type="default" themeColor="textSecondary" style={{ textAlign: 'center' }}>
                    {t('chat.noConversations')}
                  </ThemedText>
                </View>
              )
            }
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

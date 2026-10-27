import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View, type ScrollViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { M3akPalette } from '@/constants/theme';
import { chatErrorMessageKey } from '@/features/chat/api';
import { useAskChat, useChatMessages } from '@/features/chat/hooks';
import type { ChatMessage } from '@/features/chat/types';
import { useLanguage } from '@/i18n/use-language';

const SUGGESTIONS = ['returnsWeek', 'availableWeekend', 'whoHasCar', 'whoDamage', 'returnsTomorrow'] as const;

function Bubble({ message, onOpenSource }: { message: ChatMessage; onOpenSource: (id: string) => void }) {
  const mine = message.role === 'user';
  return (
    <View className={`max-w-[88%] gap-2 ${mine ? 'self-end' : 'self-start'}`}>
      <View className="rounded-2xl px-4 py-3" style={{ backgroundColor: mine ? M3akPalette.mauve : '#fff', borderWidth: mine ? 0 : 1, borderColor: '#EAE5F2' }}>
        <ThemedText type="default" style={{ color: mine ? '#fff' : undefined }} selectable>
          {message.content}
        </ThemedText>
      </View>
      {!mine && message.sources.length > 0 ? (
        <View className="flex-row flex-wrap gap-2">
          {message.sources.map((source) => (
            <Pressable key={source.id} onPress={() => onOpenSource(source.id)} className="flex-row items-center gap-1 rounded-full bg-[#F3EEFF] px-3 py-1">
              <Ionicons name="document-text-outline" size={13} color={M3akPalette.mauve} />
              <ThemedText type="small" style={{ color: M3akPalette.mauve, fontSize: 12 }} numberOfLines={1}>
                {source.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default function ChatConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, language } = useLanguage();
  const [conversationId, setConversationId] = useState<string | null>(id && id !== 'nouveau' ? id : null);
  const [text, setText] = useState('');
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const messagesQuery = useChatMessages(conversationId);
  const ask = useAskChat();
  const scrollRef = useRef<ScrollViewInstance>(null);

  const messages = messagesQuery.data ?? [];

  useEffect(() => {
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
    return () => clearTimeout(timer);
  }, [messages.length, pendingQuestion]);

  function send(question: string) {
    const message = question.trim();
    if (!message || ask.isPending) return;
    setError(null);
    setPendingQuestion(message);
    setText('');
    ask.mutate(
      { message, conversationId, language: language === 'ar' ? 'ar' : 'fr' },
      {
        onSuccess: (answer) => setConversationId(answer.conversationId),
        onError: (err) => {
          setError(t(chatErrorMessageKey(err)));
          setText(message);
        },
        onSettled: () => setPendingQuestion(null),
      }
    );
  }

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right', 'bottom']}>
        <ScreenHeader title={t('chat.title')} showBack />
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView ref={scrollRef} contentContainerClassName="gap-3 px-6 pb-4" keyboardShouldPersistTaps="handled">
            {messages.length === 0 && !pendingQuestion ? (
              <View className="gap-3 pt-2">
                <ThemedText type="default" themeColor="textSecondary">
                  {t('chat.intro')}
                </ThemedText>
                <View className="flex-row flex-wrap gap-2">
                  {SUGGESTIONS.map((key) => (
                    <Pressable key={key} onPress={() => send(t(`chat.suggestions.${key}`))} className="rounded-full border border-[#EAE5F2] bg-white px-4 py-2">
                      <ThemedText type="small">{t(`chat.suggestions.${key}`)}</ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {messages.map((message) => (
              <Bubble key={message.id} message={message} onOpenSource={(sourceId) => router.push({ pathname: '/locations/[id]', params: { id: sourceId } })} />
            ))}

            {pendingQuestion ? (
              <>
                <Bubble message={{ id: 'pending', role: 'user', content: pendingQuestion, sources: [], createdAt: '' }} onOpenSource={() => {}} />
                <View className="flex-row items-center gap-2 self-start rounded-2xl border border-[#EAE5F2] bg-white px-4 py-3">
                  <ActivityIndicator color={M3akPalette.mauve} size="small" />
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('chat.thinking')}
                  </ThemedText>
                </View>
              </>
            ) : null}

            {error ? (
              <ThemedText type="small" style={{ color: '#DC2626' }}>
                {error}
              </ThemedText>
            ) : null}
          </ScrollView>

          <View className="flex-row items-end gap-2 border-t border-[#EAE5F2] bg-white px-4 py-3">
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={t('chat.placeholder')}
              multiline
              maxLength={600}
              className="max-h-28 min-h-11 flex-1 rounded-2xl border border-[#EAE5F2] px-4 py-2"
              style={{ fontFamily: 'Cairo_400Regular', textAlignVertical: 'top' }}
              editable={!ask.isPending}
            />
            <Pressable
              onPress={() => send(text)}
              disabled={ask.isPending || text.trim() === ''}
              accessibilityLabel={t('chat.send')}
              className="h-11 w-11 items-center justify-center rounded-full"
              style={{ backgroundColor: M3akPalette.mauve, opacity: ask.isPending || text.trim() === '' ? 0.4 : 1 }}
            >
              <Ionicons name="send" size={18} color="#fff" />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

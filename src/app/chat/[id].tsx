import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View, type ScrollViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Palette, Shadows } from '@/constants/theme';
import { chatErrorMessageKey } from '@/features/chat/api';
import { ChatAvatar, ChatBubble, TypingBubble } from '@/features/chat/chat-bubble';
import { useAskChat, useChatMessages } from '@/features/chat/hooks';
import type { ChatMessage } from '@/features/chat/types';
import { isRTL } from '@/i18n';
import { useLanguage } from '@/i18n/use-language';

const SUGGESTIONS: { key: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'returnsTomorrow', icon: 'return-down-back-outline' },
  { key: 'returnsWeek', icon: 'calendar-outline' },
  { key: 'availableWeekend', icon: 'car-sport-outline' },
  { key: 'whoHasCar', icon: 'person-outline' },
  { key: 'whoDamage', icon: 'construct-outline' },
];

export default function ChatConversationScreen() {
  const { id, question, dictate } = useLocalSearchParams<{ id: string; question?: string; dictate?: string }>();
  const { t, language } = useLanguage();
  const [conversationId, setConversationId] = useState<string | null>(id && id !== 'nouveau' ? id : null);
  const [text, setText] = useState('');
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Messages de cette séance : la réponse s'affiche tout de suite, sans attendre que l'historique soit relu en base.
  const [liveMessages, setLiveMessages] = useState<ChatMessage[]>([]);
  const messagesQuery = useChatMessages(conversationId);
  const ask = useAskChat();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const rtl = isRTL(language);

  const serverMessages = messagesQuery.data ?? [];
  const lastServer = serverMessages.slice(-6);
  const messages = [
    ...serverMessages,
    ...liveMessages.filter((live) => !lastServer.some((saved) => saved.role === live.role && saved.content === live.content)),
  ];
  const canSend = text.trim() !== '' && !ask.isPending;

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
        onSuccess: (answer) => {
          const stamp = new Date().toISOString();
          setLiveMessages((previous) => [
            ...previous,
            { id: `live-user-${stamp}`, role: 'user', content: message, sources: [], createdAt: stamp },
            { id: `live-answer-${stamp}`, role: 'assistant', content: answer.answer, sources: answer.sources, createdAt: stamp },
          ]);
          setConversationId(answer.conversationId);
        },
        onError: (err) => {
          setError(t(chatErrorMessageKey(err)));
          setText(message);
        },
        onSettled: () => setPendingQuestion(null),
      }
    );
  }

  // Question venue de l'accueil (pastille de suggestion) : envoyée une seule fois, dès l'ouverture d'une nouvelle conversation.
  const autoSent = useRef(false);
  useEffect(() => {
    if (autoSent.current || !question || conversationId) return;
    autoSent.current = true;
    send(question);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question]);

  const empty = messages.length === 0 && !pendingQuestion;

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="w-full flex-1" edges={['top', 'left', 'right', 'bottom']}>
        {/* En-tête : pastille BIBIP, nom et état */}
        <View className="flex-row items-center gap-3 border-b border-border bg-card px-4 pb-3 pt-2" style={Shadows.card}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityLabel={t('common.back')}
            className="h-11 w-11 items-center justify-center rounded-full bg-primary-soft"
          >
            <Ionicons name={rtl ? 'chevron-forward' : 'chevron-back'} size={22} color={Brand.graphite} />
          </Pressable>
          <ChatAvatar size={40} />
          <View className="flex-1">
            <ThemedText type="smallBold" style={{ fontSize: 16 }}>
              {t('chat.title')}
            </ThemedText>
            <View className="flex-row items-center gap-1.5">
              <View className="h-2 w-2 rounded-full bg-success" />
              <ThemedText type="small" style={{ color: Palette.textSecondary, fontSize: 12 }}>
                {t('chat.online')}
              </ThemedText>
            </View>
          </View>
        </View>

        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView ref={scrollRef} contentContainerClassName="gap-4 px-4 pb-4 pt-4" keyboardShouldPersistTaps="handled">
            {empty ? (
              <View className="gap-5 pt-4">
                <View className="items-center gap-3 px-4">
                  <ChatAvatar size={64} />
                  <ThemedText type="smallBold" style={{ fontSize: 20, lineHeight: 28, textAlign: 'center' }}>
                    {t('chat.welcomeTitle')}
                  </ThemedText>
                  <ThemedText type="default" style={{ color: Palette.textSecondary, textAlign: 'center' }}>
                    {t('chat.intro')}
                  </ThemedText>
                </View>
                <View className="gap-2">
                  <ThemedText type="small" style={{ color: Palette.textSecondary }}>
                    {t('chat.tryAsking')}
                  </ThemedText>
                  {SUGGESTIONS.map((suggestion) => (
                    <Pressable
                      key={suggestion.key}
                      onPress={() => send(t(`chat.suggestions.${suggestion.key}`))}
                      accessibilityRole="button"
                      className="min-h-14 flex-row items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 active:bg-primary-soft"
                      style={Shadows.card}
                    >
                      <View className="h-9 w-9 items-center justify-center rounded-full bg-primary-soft">
                        <Ionicons name={suggestion.icon} size={18} color={Palette.primary} />
                      </View>
                      <ThemedText type="small" style={{ flex: 1, color: Palette.textPrimary, fontWeight: '600' }}>
                        {t(`chat.suggestions.${suggestion.key}`)}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {messages.map((message) => (
              <ChatBubble key={message.id} message={message} onOpenSource={(sourceId) => router.push({ pathname: '/locations/[id]', params: { id: sourceId } })} />
            ))}

            {pendingQuestion ? (
              <>
                <ChatBubble message={{ id: 'pending', role: 'user', content: pendingQuestion, sources: [], createdAt: new Date().toISOString() }} onOpenSource={() => {}} />
                <TypingBubble label={t('chat.thinking')} />
              </>
            ) : null}

            {error ? (
              <View className="flex-row items-start gap-2 rounded-2xl border border-error/30 bg-error-soft p-3">
                <Ionicons name="alert-circle" size={18} color={Palette.error} />
                <ThemedText type="small" style={{ flex: 1, color: Palette.error }}>
                  {error}
                </ThemedText>
              </View>
            ) : null}
          </ScrollView>

          {/* Zone de saisie : tout en bas (zone du pouce), bouton d'envoi rond */}
          <View className="border-t border-border bg-card px-4 py-3">
            <View className="flex-row items-end gap-2 rounded-2xl border border-border bg-background py-1.5 pe-1.5 ps-4">
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder={t('chat.placeholder')}
                placeholderTextColor={Palette.textMuted}
                multiline
                maxLength={600}
                className="max-h-28 min-h-11 flex-1 py-2 text-base"
                style={{ fontFamily: 'Cairo_500Medium', color: Palette.textPrimary, textAlignVertical: 'center' }}
                editable={!ask.isPending}
                // Micro de l'accueil : la saisie est déjà active, le clavier du téléphone propose sa dictée.
                autoFocus={dictate === '1'}
                returnKeyType="default"
              />
              <Pressable
                onPress={() => send(text)}
                disabled={!canSend}
                accessibilityRole="button"
                accessibilityLabel={t('chat.send')}
                className="h-11 w-11 items-center justify-center rounded-full"
                style={[{ backgroundColor: canSend ? Palette.primary : Palette.surfaceAlt }]}
              >
                <Ionicons name="arrow-up" size={22} color={Brand.white} />
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

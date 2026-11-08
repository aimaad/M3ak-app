import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View, type ScrollViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { Brand, HomeFonts, Palette } from '@/constants/theme';
import { chatErrorMessageKey } from '@/features/chat/api';
import { ActionPill, ChatAvatar, DataCardView, DateSeparator, SmallPill, TypingBubble, UserBubble, VoiceBubble } from '@/features/chat/chat-bubble';
import { useAskChat, useChatMessages, useConversations, useDeleteConversation, useRenameConversation } from '@/features/chat/hooks';
import { canListen, detectMessageLanguage, type MessageLanguage } from '@/features/chat/language';
import { RenameDialog } from '@/features/chat/rename-dialog';
import { useSpeech } from '@/features/chat/speech';
import { useVoicePlayback } from '@/features/chat/use-voice-playback';
import { makeTitle } from '@/features/chat/titles';
import type { ChatCard, ChatCardItem, ChatMessage } from '@/features/chat/types';
import { newId } from '@/features/chat/uuid';
import { VOICE_ENABLED } from '@/features/chat/voice-flag';
import { ArrowIcon, HText } from '@/features/dashboard/home-ui';
import { useLanguage } from '@/i18n/use-language';

const SUGGESTIONS = ['returnsTomorrow', 'returnsWeek', 'availableWeekend', 'whoHasCar', 'whoDamage'] as const;
const circle = { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.card, alignItems: 'center' as const, justifyContent: 'center' as const };

/** Pastilles d'action sous une réponse (2 au plus), déduites de la carte de données : jamais inventées par le modèle. */
function actionsFor(cards: ChatCard[], t: (key: string, o?: Record<string, unknown>) => string): { key: string; label: string; run: () => void }[] {
  const card = cards[0];
  if (!card) return [];
  if (card.type === 'vehicles') {
    const first = card.items[0];
    return [
      { key: 'book', label: t('chat.convo.bookVehicle', { vehicle: first.title }), run: () => router.push({ pathname: '/locations/nouveau', params: { vehicleId: first.id, date: todayKey() } }) },
      { key: 'planning', label: t('chat.convo.planning'), run: () => router.push('/locations/calendrier') },
    ];
  }
  return [
    { key: 'planning', label: t('chat.convo.planning'), run: () => router.push('/locations/calendrier') },
    { key: 'rentals', label: t('chat.convo.rentals'), run: () => router.push('/locations') },
  ];
}
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function openCardItem(item: ChatCardItem) {
  if (item.kind === 'vehicle') router.push({ pathname: '/locations/nouveau', params: { vehicleId: item.id, date: todayKey() } });
  else router.push({ pathname: '/locations/[id]', params: { id: item.id } });
}

export default function ChatConversationRoute() {
  const params = useLocalSearchParams<{ id: string; question?: string; fresh?: string }>();
  // Une clé par ouverture : « Nouvelle conversation » depuis une conversation repart d'un écran neuf.
  return <Conversation key={`${params.id}:${params.fresh ?? ''}:${params.question ?? ''}`} id={params.id} question={params.question} />;
}

function Conversation({ id, question }: { id: string; question?: string }) {
  const { t, language } = useLanguage();
  const rtl = language === 'ar';
  const [conversationId, setConversationId] = useState<string | null>(id && id !== 'nouveau' ? id : null);
  const [draftId] = useState(() => newId());
  const [text, setText] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [failed, setFailed] = useState<{ message: string; errorKey: string } | null>(null);
  // Messages de cette séance : la réponse s'affiche tout de suite, sans attendre que l'historique soit relu en base.
  const [liveMessages, setLiveMessages] = useState<ChatMessage[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const messagesQuery = useChatMessages(conversationId);
  const conversations = useConversations();
  const rename = useRenameConversation();
  const { mutate: removeConversation } = useDeleteConversation();
  const ask = useAskChat();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const { speakingId, toggle } = useSpeech();
  const playback = useVoicePlayback();

  const serverMessages = messagesQuery.data ?? [];
  const lastServer = serverMessages.slice(-6);
  const messages = useMemo(
    () => [...serverMessages, ...liveMessages.filter((live) => !lastServer.some((saved) => saved.role === live.role && saved.content === live.content))],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [messagesQuery.data, liveMessages]
  );

  useEffect(() => {
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
    return () => clearTimeout(timer);
  }, [messages.length, pending, failed]);

  const send = useCallback(
    (raw: string) => {
      const message = raw.trim();
      if (!message || ask.isPending) return;
      setFailed(null);
      setPending(message);
      setText('');
      ask.mutate(
        {
          message,
          conversationId,
          language: language === 'ar' ? 'ar' : 'fr',
          // Conversation neuve : même identifiant à chaque essai, donc jamais de doublon si l'envoi est réessayé.
          ...(conversationId ? {} : { newConversationId: draftId, title: makeTitle(message) }),
        },
        {
          onSuccess: (answer) => {
            const stamp = new Date().toISOString();
            setLiveMessages((previous) => [
              ...previous,
              { id: `live-user-${stamp}`, role: 'user', content: message, sources: [], cards: [], audioPath: null, audioMs: null, viaVoice: false, createdAt: stamp },
              { id: `live-answer-${stamp}`, role: 'assistant', content: answer.answer, sources: answer.sources, cards: answer.cards, audioPath: null, audioMs: null, viaVoice: false, createdAt: stamp },
            ]);
            setConversationId(answer.conversationId);
          },
          onError: (error) => setFailed({ message, errorKey: chatErrorMessageKey(error) }),
          onSettled: () => setPending(null),
        }
      );
    },
    [ask, conversationId, draftId, language]
  );

  // Question venue de l'accueil ou de l'historique : envoyée une seule fois, dès l'ouverture d'une nouvelle conversation.
  const autoSent = useRef(false);
  useEffect(() => {
    if (autoSent.current || !question || conversationId) return;
    autoSent.current = true;
    send(question);
  }, [question, conversationId, send]);

  const current = conversations.data?.find((c) => c.id === conversationId);
  const firstQuestion = messages.find((m) => m.role === 'user')?.content ?? pending ?? failed?.message ?? '';
  const title = current?.title || (firstQuestion ? makeTitle(firstQuestion) : '') || t('chat.untitled');
  const lastAnswer = [...messages].reverse().find((m) => m.role === 'assistant');
  const answerLanguage: MessageLanguage = lastAnswer ? detectMessageLanguage(lastAnswer.content) : language === 'ar' ? 'ar' : 'fr';
  const subtitleKey = answerLanguage === 'fr' ? 'fr' : 'darija';
  const subtitle = t(`chat.convo.respondsIn.${lastAnswer || pending ? subtitleKey : language === 'ar' ? 'darija' : 'fr'}`);

  const empty = messages.length === 0 && !pending && !failed;
  const canSend = text.trim() !== '' && !ask.isPending;
  const locale = language === 'ar' ? 'ar-MA' : 'fr-FR';

  const dayLabel = (iso: string) => {
    const date = new Date(iso);
    const now = new Date();
    const days = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) / 86_400_000);
    const time = date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    const day = days <= 0 ? t('chat.convo.today') : days === 1 ? t('chat.convo.yesterday') : date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
    return `${day} · ${time}`;
  };

  const copy = async (message: ChatMessage) => {
    await Clipboard.setStringAsync(message.content);
    setCopiedId(message.id);
    setTimeout(() => setCopiedId((value) => (value === message.id ? null : value)), 1500);
  };

  const openMenu = () =>
    Alert.alert(title, undefined, [
      ...(conversationId ? [{ text: t('chat.convo.rename'), onPress: () => setRenaming(true) }] : []),
      ...(conversationId
        ? [
            {
              text: t('chat.convo.delete'),
              style: 'destructive' as const,
              onPress: () =>
                Alert.alert(t('chat.convo.deleteTitle'), t('chat.convo.deleteBody'), [
                  { text: t('common.cancel'), style: 'cancel' },
                  {
                    text: t('chat.convo.delete'),
                    style: 'destructive',
                    onPress: () => {
                      removeConversation(conversationId);
                      router.replace('/chat');
                    },
                  },
                ]),
            },
          ]
        : []),
      { text: t('common.cancel'), style: 'cancel' },
    ]);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/chat'));
  const lastIndex = messages.length - 1;
  const fieldFont = language === 'ar' ? HomeFonts.arabic.medium : HomeFonts.text.regular;

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="w-full flex-1" edges={['top', 'left', 'right', 'bottom']}>
        {/* En-tête */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Palette.surfaceAlt }}>
          <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel={t('chat.convo.back')} style={circle}>
            <Ionicons name={rtl ? 'chevron-forward' : 'chevron-back'} size={20} color={Palette.textPrimary} />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <HText weight="semibold" size={15} numberOfLines={1} accessibilityRole="header">
              {title}
            </HText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: Palette.success }} />
              <HText size={11} color={Palette.textSecondary} numberOfLines={1}>
                {subtitle}
              </HText>
            </View>
          </View>
          <Pressable onPress={() => router.replace({ pathname: '/chat/[id]', params: { id: 'nouveau', fresh: String(Date.now()) } })} accessibilityRole="button" accessibilityLabel={t('chat.convo.newConversation')} style={circle}>
            <Ionicons name="create-outline" size={17} color={Palette.textPrimary} />
          </Pressable>
          <Pressable onPress={openMenu} accessibilityRole="button" accessibilityLabel={t('chat.convo.menu')} style={circle}>
            <Ionicons name="ellipsis-horizontal" size={17} color={Palette.textPrimary} />
          </Pressable>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 14 }}>
            {empty ? (
              <View style={{ gap: 20, paddingTop: 16 }}>
                <View style={{ alignItems: 'center', gap: 12, paddingHorizontal: 16 }}>
                  <ChatAvatar size={64} />
                  <HText font="display" weight="semibold" size={20} style={{ textAlign: 'center' }}>
                    {t('chat.welcomeTitle')}
                  </HText>
                  <HText size={14} color={Palette.textSecondary} style={{ textAlign: 'center' }}>
                    {t('chat.intro')}
                  </HText>
                </View>
                <View style={{ gap: 8 }}>
                  <HText size={12} color={Palette.textSecondary}>
                    {t('chat.tryAsking')}
                  </HText>
                  {SUGGESTIONS.map((key) => (
                    <Pressable key={key} onPress={() => send(t(`chat.suggestions.${key}`))} accessibilityRole="button" style={{ minHeight: 48, justifyContent: 'center', borderWidth: 1, borderColor: Palette.border, borderRadius: 14, paddingHorizontal: 14, backgroundColor: Palette.card }}>
                      <HText weight="medium" size={14}>
                        {t(`chat.suggestions.${key}`)}
                      </HText>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {messages.map((message, index) => {
              const previous = messages[index - 1];
              const newDay = !previous || new Date(previous.createdAt).toDateString() !== new Date(message.createdAt).toDateString();
              return (
                <View key={message.id} style={{ gap: 14 }}>
                  {newDay ? <DateSeparator label={dayLabel(message.createdAt)} /> : null}
                  {message.role === 'user' && message.audioPath && message.viaVoice ? (
                    <VoiceBubble
                      seed={message.audioPath}
                      durationMs={message.audioMs ?? 0}
                      transcript={message.content}
                      playing={playback.playingId === message.id}
                      progress={playback.progress[message.id] ?? 0}
                      onToggle={() => void playback.toggle(message.id, message.audioPath as string, message.audioMs ?? 0)}
                    />
                  ) : message.role === 'user' ? (
                    <UserBubble text={message.content} />
                  ) : (
                    <AssistantMessage
                      message={message}
                      isLast={index === lastIndex}
                      speaking={speakingId === message.id}
                      copied={copiedId === message.id}
                      onListen={(lang) => toggle(message.id, message.content, lang)}
                      onCopy={() => void copy(message)}
                      onOpenSource={(sourceId) => router.push({ pathname: '/locations/[id]', params: { id: sourceId } })}
                      t={t}
                    />
                  )}
                </View>
              );
            })}

            {pending ? (
              <>
                <UserBubble text={pending} />
                <TypingBubble />
              </>
            ) : null}

            {failed ? (
              <>
                <UserBubble text={failed.message} />
                <View accessibilityLiveRegion="polite" style={{ alignSelf: 'flex-start', gap: 4, maxWidth: 300 }}>
                  <HText size={13} color={Palette.error}>
                    {t(failed.errorKey)}
                  </HText>
                  <Pressable onPress={() => send(failed.message)} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
                    <HText weight="semibold" size={13}>
                      {t('chat.convo.retry')}
                    </HText>
                  </Pressable>
                </View>
              </>
            ) : null}
          </ScrollView>

          {/* Zone de saisie : fixe en bas, le clavier ne la masque jamais */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, backgroundColor: Palette.card, borderTopWidth: 1, borderTopColor: Palette.surfaceAlt }}>
            <View style={{ flex: 1, height: 48, borderRadius: 24, backgroundColor: Palette.surface, borderWidth: 1, borderColor: Palette.border, paddingHorizontal: 16, justifyContent: 'center' }}>
              <TextInput
                value={text}
                onChangeText={setText}
                onSubmitEditing={() => send(text)}
                placeholder={t('chat.convo.placeholder')}
                placeholderTextColor={Palette.textSecondary}
                maxLength={600}
                returnKeyType="send"
                editable={!ask.isPending}
                accessibilityLabel={t('chat.convo.placeholder')}
                style={{ fontSize: 15, color: Palette.textPrimary, fontFamily: fieldFont, paddingVertical: 0 }}
              />
            </View>
            {VOICE_ENABLED && !canSend ? (
              <Pressable onPress={() => router.push(conversationId ? { pathname: '/chat/vocal', params: { conversation: conversationId } } : '/chat/vocal')} accessibilityRole="button" accessibilityLabel={t('chat.convo.mic')} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: Brand.orange, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="mic-outline" size={21} color={Brand.white} />
              </Pressable>
            ) : (
              <Pressable
                onPress={() => send(text)}
                disabled={!canSend}
                accessibilityRole="button"
                accessibilityLabel={t('chat.convo.send')}
                accessibilityState={{ disabled: !canSend }}
                style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: canSend ? Brand.orange : Palette.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}
              >
                <ArrowIcon color={canSend ? Brand.white : Palette.textMuted} size={20} />
              </Pressable>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {renaming && conversationId ? (
        <RenameDialog
          visible
          initialTitle={title}
          onClose={() => setRenaming(false)}
          onSave={(next) => {
            rename.mutate({ id: conversationId, title: next });
            setRenaming(false);
          }}
        />
      ) : null}
    </ThemedView>
  );
}

/** Réponse de BIBIP : avatar, bulle (texte + carte de données), « Écouter » / « Copier », puis suggestions d'actions. */
function AssistantMessage({
  message,
  isLast,
  speaking,
  copied,
  onListen,
  onCopy,
  onOpenSource,
  t,
}: {
  message: ChatMessage;
  isLast: boolean;
  speaking: boolean;
  copied: boolean;
  onListen: (language: MessageLanguage) => void;
  onCopy: () => void;
  onOpenSource: (rentalId: string) => void;
  t: (key: string, o?: Record<string, unknown>) => string;
}) {
  const language = detectMessageLanguage(message.content);
  const actions = isLast ? actionsFor(message.cards, t) : [];
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
        <ChatAvatar />
        <View style={{ flex: 1, minWidth: 0, backgroundColor: Palette.surface, borderRadius: 20, borderBottomStartRadius: 6, padding: 12, gap: 10 }}>
          <HText size={15} style={{ lineHeight: 22, paddingHorizontal: 2 }} selectable>
            {message.content}
          </HText>
          {message.cards.map((card, index) => (
            <DataCardView key={index} card={card} onOpen={openCardItem} />
          ))}
          {message.cards.length === 0 && message.sources.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {message.sources.map((source) => (
                <Pressable key={source.id} onPress={() => onOpenSource(source.id)} accessibilityRole="button" style={{ minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 16, borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.card, paddingHorizontal: 10 }}>
                  <Ionicons name="document-text-outline" size={14} color={Brand.graphite} />
                  <HText weight="semibold" size={12} numberOfLines={1}>
                    {source.label}
                  </HText>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </View>

      {/* Sous la bulle (alignées avec elle) : écouter / copier, puis les suggestions d'actions */}
      <View style={{ marginStart: 36, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {canListen(language) ? (
            <SmallPill
              icon={speaking ? 'stop-outline' : 'volume-high-outline'}
              label={t(speaking ? 'chat.convo.stopListening' : 'chat.convo.listen')}
              a11yLabel={t(speaking ? 'chat.convo.stopListening' : 'chat.convo.listenA11y')}
              onPress={() => onListen(language)}
              active={speaking}
            />
          ) : null}
          <SmallPill icon={copied ? 'checkmark' : 'copy-outline'} a11yLabel={t(copied ? 'chat.convo.copied' : 'chat.convo.copy')} onPress={onCopy} />
        </View>
        {actions.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {actions.map((action) => (
              <ActionPill key={action.key} label={action.label} onPress={action.run} />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { useUndo } from '@/components/undo-toast';
import { Brand, HomeFonts, Palette } from '@/constants/theme';
import { useMyAgency, useMyProfile } from '@/features/agency/hooks';
import { ConversationRow } from '@/features/chat/conversation-row';
import { DeferredDeleter } from '@/features/chat/deferred-delete';
import { groupConversations, matchesSearch } from '@/features/chat/history';
import { useConversations, useConversationSearch, useDeleteConversation, useRenameConversation } from '@/features/chat/hooks';
import { RenameDialog } from '@/features/chat/rename-dialog';
import type { ChatConversation } from '@/features/chat/types';
import { VOICE_ENABLED } from '@/features/chat/voice-flag';
import { headerFirstName } from '@/features/dashboard/header-format';
import { ArrowIcon, HText, MicroLabel, Skeleton } from '@/features/dashboard/home-ui';
import { useOcrSettings } from '@/features/ocr/hooks';
import { useLanguage } from '@/i18n/use-language';

const SWIPED_KEY = 'bibip.chat.swiped.v1';
const UNDO_MS = 5000;
const SUGGESTIONS = ['returnsTomorrow', 'returnsWeek', 'availableWeekend'] as const;

/**
 * Chat BIBIP : l'historique. Carte d'accueil sombre (nouvelle question), recherche, conversations groupées par date, glissement
 * pour supprimer (avec « Annuler » pendant 5 s), appui long pour renommer ou supprimer.
 */
export default function ChatHistoryScreen() {
  const { t, language } = useLanguage();
  const { showUndo } = useUndo();
  const agency = useMyAgency();
  const profile = useMyProfile(agency.data?.agencyId);
  const { chatAvailability, isLoading: settingsLoading } = useOcrSettings();
  const conversations = useConversations();
  const { mutate: removeConversation } = useDeleteConversation();
  const renameMutation = useRenameConversation();
  const active = chatAvailability === 'active';

  const [question, setQuestion] = useState('');
  const [search, setSearch] = useState('');
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [renaming, setRenaming] = useState<ChatConversation | null>(null);
  const [swiped, setSwiped] = useState<boolean | null>(null);
  const remote = useConversationSearch(search);

  useEffect(() => {
    AsyncStorage.getItem(SWIPED_KEY).then((v) => setSwiped(v === '1')).catch(() => setSwiped(false));
  }, []);

  // Suppression différée : la conversation disparaît tout de suite, la vraie suppression a lieu après 5 s sauf « Annuler ».
  const [deleter] = useState(
    () => new DeferredDeleter<ChatConversation>({ delayMs: UNDO_MS, commit: (item) => removeConversation(item.id), onChange: setHidden })
  );
  useEffect(() => () => deleter.flush(), [deleter]);

  const markSwiped = useCallback(() => {
    setSwiped(true);
    AsyncStorage.setItem(SWIPED_KEY, '1').catch(() => undefined);
  }, []);

  const requestDelete = useCallback(
    (conversation: ChatConversation) => {
      markSwiped();
      deleter.schedule(conversation.id, conversation);
      showUndo({
        message: t('chat.history.deleted'),
        actionLabel: t('chat.history.undo'),
        durationMs: UNDO_MS,
        onUndo: () => deleter.undo(conversation.id),
      });
    },
    [deleter, markSwiped, showUndo, t]
  );

  const openMenu = useCallback(
    (conversation: ChatConversation) =>
      Alert.alert(conversation.title || t('chat.untitled'), undefined, [
        { text: t('chat.history.rename'), onPress: () => setRenaming(conversation) },
        { text: t('chat.history.delete'), style: 'destructive', onPress: () => requestDelete(conversation) },
        { text: t('common.cancel'), style: 'cancel' },
      ]),
    [requestDelete, t]
  );

  const visible = useMemo(() => {
    const all = (conversations.data ?? []).filter((c) => !hidden.has(c.id));
    const q = search.trim();
    if (q.length < 2) return all;
    const remoteIds = new Set(remote.data ?? []);
    return all.filter((c) => matchesSearch(c, q) || remoteIds.has(c.id));
  }, [conversations.data, hidden, search, remote.data]);
  const sections = useMemo(() => groupConversations(visible, new Date()), [visible]);
  const locale = language === 'ar' ? 'ar-MA' : 'fr-FR';

  const name = headerFirstName(profile.data?.prenom, profile.data?.nomComplet ?? agency.data?.memberName);
  const startChat = (text: string) => {
    const trimmed = text.trim();
    router.push(trimmed ? { pathname: '/chat/[id]', params: { id: 'nouveau', question: trimmed } } : '/chat/nouveau');
    setQuestion('');
  };
  const sectionLabel = (section: (typeof sections)[number]) =>
    section.kind === 'today'
      ? t('chat.history.sectionToday')
      : section.kind === 'yesterday'
        ? t('chat.history.sectionYesterday')
        : section.kind === 'week'
          ? t('chat.history.sectionWeek')
          : (section.month as Date).toLocaleDateString(locale, { month: 'long', ...((section.month as Date).getFullYear() !== new Date().getFullYear() ? { year: 'numeric' as const } : {}) });

  const greeting = name ? t('chat.history.greeting', { name }) : t('chat.history.greetingNoName');
  const circle = { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.card, alignItems: 'center' as const, justifyContent: 'center' as const };

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="w-full flex-1" edges={['top', 'left', 'right']}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 18 }}>
          {/* En-tête */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/accueil'))} accessibilityRole="button" accessibilityLabel={t('chat.history.back')} style={circle}>
              <Ionicons name={language === 'ar' ? 'chevron-forward' : 'chevron-back'} size={20} color={Palette.textPrimary} />
            </Pressable>
            <HText font="display" weight="bold" size={17}>
              {t('chat.title')}
            </HText>
            <Pressable onPress={() => startChat('')} accessibilityRole="button" accessibilityLabel={t('chat.newConversation')} style={circle}>
              <Ionicons name="create-outline" size={18} color={Palette.textPrimary} />
            </Pressable>
          </View>

          {settingsLoading ? (
            <Skeleton height={190} radius={24} />
          ) : !active ? (
            <View style={{ alignItems: 'center', gap: 12, paddingVertical: 40, paddingHorizontal: 12 }}>
              <Ionicons name="chatbubbles-outline" size={44} color={Palette.primary} />
              <HText size={15} color={Palette.textSecondary} style={{ textAlign: 'center' }}>
                {t(chatAvailability === 'owner_can_enable' ? 'chat.inactive.ownerCanEnable' : chatAvailability === 'ask_owner' ? 'chat.inactive.askOwner' : 'chat.inactive.noKey')}
              </HText>
            </View>
          ) : (
            <>
              {/* Carte d'accueil sombre */}
              <View style={{ backgroundColor: Brand.graphite, borderRadius: 24, paddingTop: 20, paddingHorizontal: 18, paddingBottom: 18, gap: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: Brand.successOnDark }} />
                  <MicroLabel size={10} track={0.16} color={Brand.mutedOnDark}>
                    {t('chat.history.status')}
                  </MicroLabel>
                </View>
                <HText font="display" weight="semibold" size={23} color={Brand.white} track={-0.01} style={{ lineHeight: 30 }}>
                  {greeting}
                </HText>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Brand.surfaceOnDark, borderWidth: 1, borderColor: Brand.strokeOnDark, borderRadius: 18, paddingVertical: 6, paddingStart: 16, paddingEnd: 6 }}>
                  <TextInput
                    value={question}
                    onChangeText={setQuestion}
                    onSubmitEditing={() => startChat(question)}
                    placeholder={t('chat.history.askPlaceholder')}
                    placeholderTextColor={Brand.mutedOnDark}
                    returnKeyType="send"
                    maxLength={600}
                    accessibilityLabel={t('chat.history.askPlaceholder')}
                    style={{ flex: 1, minWidth: 0, height: 44, color: Brand.white, fontSize: 14, fontFamily: language === 'ar' ? HomeFonts.arabic.medium : HomeFonts.text.regular, paddingVertical: 0 }}
                  />
                  {VOICE_ENABLED && !question.trim() ? (
                    <Pressable onPress={() => router.push('/chat/vocal')} accessibilityRole="button" accessibilityLabel={t('chat.history.askMic')} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: Brand.orange, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="mic-outline" size={20} color={Brand.white} />
                    </Pressable>
                  ) : (
                    <Pressable onPress={() => startChat(question)} accessibilityRole="button" accessibilityLabel={t('chat.history.askSend')} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: Brand.orange, alignItems: 'center', justifyContent: 'center' }}>
                      <ArrowIcon color={Brand.white} size={18} />
                    </Pressable>
                  )}
                </View>
                <HText size={12} color={Brand.mutedOnDark}>
                  {t('chat.history.hint')}
                </HText>
              </View>

              {/* Recherche */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 44, borderRadius: 14, backgroundColor: Palette.surface, borderWidth: 1, borderColor: Palette.border, paddingHorizontal: 14 }}>
                <Ionicons name="search-outline" size={17} color={Palette.textSecondary} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder={t('chat.history.searchPlaceholder')}
                  placeholderTextColor={Palette.textSecondary}
                  accessibilityLabel={t('chat.history.searchLabel')}
                  returnKeyType="search"
                  style={{ flex: 1, height: 44, fontSize: 14, color: Palette.textPrimary, fontFamily: language === 'ar' ? HomeFonts.arabic.medium : HomeFonts.text.regular, paddingVertical: 0 }}
                />
              </View>

              {/* Liste */}
              {conversations.isLoading ? (
                <View style={{ gap: 12 }}>
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} height={52} radius={14} />
                  ))}
                </View>
              ) : conversations.isError ? (
                <View style={{ alignItems: 'flex-start', gap: 8 }}>
                  <HText size={14} color={Palette.textSecondary}>
                    {t('chat.history.loadError')}
                  </HText>
                  <Pressable onPress={() => void conversations.refetch()} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
                    <HText weight="semibold" size={14}>
                      {t('chat.history.retry')}
                    </HText>
                  </Pressable>
                </View>
              ) : sections.length === 0 ? (
                <View style={{ gap: 12 }}>
                  <HText weight="semibold" size={15}>
                    {search.trim().length >= 2 ? t('chat.history.noResult') : t('chat.history.empty')}
                  </HText>
                  {search.trim().length < 2 ? (
                    <>
                      <HText size={13} color={Palette.textSecondary}>
                        {t('chat.history.emptyHint')}
                      </HText>
                      {SUGGESTIONS.map((key) => (
                        <Pressable key={key} onPress={() => startChat(t(`chat.suggestions.${key}`))} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: Palette.border, borderRadius: 14, paddingHorizontal: 14, backgroundColor: Palette.card }}>
                          <HText size={14} weight="medium">
                            {t(`chat.suggestions.${key}`)}
                          </HText>
                        </Pressable>
                      ))}
                    </>
                  ) : null}
                </View>
              ) : (
                <View style={{ gap: 4 }}>
                  {sections.map((section, index) => (
                    <View key={section.key} style={{ gap: 4, paddingTop: index === 0 ? 0 : 14 }}>
                      <MicroLabel size={10} track={0.16} color={Palette.textSecondary} style={{ paddingBottom: 4 }}>
                        {sectionLabel(section)}
                      </MicroLabel>
                      {section.items.map((conversation) => (
                        <ConversationRow
                          key={conversation.id}
                          conversation={conversation}
                          voice={conversation.viaVoice}
                          onOpen={() => router.push({ pathname: '/chat/[id]', params: { id: conversation.id } })}
                          onDelete={() => requestDelete(conversation)}
                          onMenu={() => openMenu(conversation)}
                        />
                      ))}
                    </View>
                  ))}
                  {swiped === false ? (
                    <HText size={12} color={Palette.textSecondary} style={{ textAlign: 'center', paddingTop: 14 }}>
                      {t('chat.history.swipeHint')}
                    </HText>
                  ) : null}
                </View>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      {renaming ? (
        <RenameDialog
          key={renaming.id}
          visible
          initialTitle={renaming.title}
          onClose={() => setRenaming(null)}
          onSave={(title) => {
            renameMutation.mutate({ id: renaming.id, title });
            setRenaming(null);
          }}
        />
      ) : null}
    </ThemedView>
  );
}

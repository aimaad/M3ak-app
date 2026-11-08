import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import { Brand, Palette } from '@/constants/theme';
import { HText } from '@/features/dashboard/home-ui';
import { isRTL } from '@/i18n';
import { useLanguage } from '@/i18n/use-language';

import type { ChatConversation } from './types';

const ACTION_WIDTH = 96;

/** Heure du jour pour une conversation d'aujourd'hui, sinon date courte (« 27 oct. »). */
export function rowTime(iso: string, now: Date, locale: string): string {
  const date = new Date(iso);
  const sameDay = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  return sameDay
    ? date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

/**
 * Une conversation de l'historique : icône (étincelle, ou micro si commencée à la voix), titre, aperçu de la dernière réponse,
 * heure. Glisser vers la gauche (vers la droite en arabe) supprime : zone rouge « Supprimer ». Appui long : menu.
 */
export function ConversationRow({
  conversation,
  voice = false,
  onOpen,
  onDelete,
  onMenu,
}: {
  conversation: ChatConversation;
  voice?: boolean;
  onOpen: () => void;
  onDelete: () => void;
  onMenu: () => void;
}) {
  const { t, language } = useLanguage();
  const rtl = isRTL(language);
  const locale = language === 'ar' ? 'ar-MA' : 'fr-FR';
  const time = rowTime(conversation.updatedAt, new Date(), locale);
  const title = conversation.title || t('chat.untitled');

  const action = () => (
    <Pressable
      onPress={onDelete}
      accessibilityRole="button"
      accessibilityLabel={t('chat.history.delete')}
      style={{ width: ACTION_WIDTH, backgroundColor: Palette.error, alignItems: 'center', justifyContent: 'center', gap: 4 }}
    >
      <Ionicons name="trash-outline" size={18} color={Brand.white} />
      <HText weight="semibold" size={12} color={Brand.white}>
        {t('chat.history.delete')}
      </HText>
    </Pressable>
  );

  return (
    <Swipeable
      friction={2}
      overshootRight={false}
      overshootLeft={false}
      rightThreshold={ACTION_WIDTH * 0.8}
      leftThreshold={ACTION_WIDTH * 0.8}
      renderRightActions={rtl ? undefined : action}
      renderLeftActions={rtl ? action : undefined}
      onSwipeableOpen={onDelete}
      containerStyle={{ overflow: 'hidden' }}
    >
      <Pressable
        onPress={onOpen}
        onLongPress={onMenu}
        accessibilityRole="button"
        accessibilityLabel={t('chat.history.rowA11y', { title, time })}
        accessibilityActions={[{ name: 'delete', label: t('chat.history.delete') }, { name: 'rename', label: t('chat.history.rename') }]}
        onAccessibilityAction={(event) => (event.nativeEvent.actionName === 'delete' ? onDelete() : onMenu())}
        style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, backgroundColor: Palette.card, borderBottomWidth: 1, borderBottomColor: Palette.surfaceAlt }}
      >
        <View style={{ width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: voice ? Palette.primarySoft : Palette.surface }}>
          <Ionicons name={voice ? 'mic-outline' : 'sparkles-outline'} size={18} color={voice ? Palette.onPrimarySoft : Brand.graphite} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <HText weight="semibold" size={15} numberOfLines={1}>
            {title}
          </HText>
          {conversation.preview ? (
            <HText size={13} color={Palette.textSecondary} numberOfLines={1}>
              {conversation.preview}
            </HText>
          ) : null}
        </View>
        <HText size={12} color={Palette.textSecondary}>
          {time}
        </HText>
      </Pressable>
    </Swipeable>
  );
}

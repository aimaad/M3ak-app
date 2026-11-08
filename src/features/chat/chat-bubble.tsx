import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';

import { Brand, Palette } from '@/constants/theme';
import { ArrowIcon, HText } from '@/features/dashboard/home-ui';
import { useLanguage } from '@/i18n/use-language';

import type { ChatCard, ChatCardItem } from './types';
import { formatDuration, voiceBars } from './voice-utils';

/** Avatar de BIBIP : carré arrondi graphite avec une étincelle orange. */
export function ChatAvatar({ size = 28 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: Math.round(size * 0.32), backgroundColor: Brand.graphite, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name="sparkles-outline" size={Math.round(size * 0.5)} color={Brand.orange} />
    </View>
  );
}

/** Message de l'utilisateur : à droite, graphite, coin bas-droit serré (rayon 20/20/6/20), 272 px au plus. */
export function UserBubble({ text }: { text: string }) {
  return (
    <View style={{ alignSelf: 'flex-end', maxWidth: 272, backgroundColor: Brand.graphite, borderRadius: 20, borderBottomEndRadius: 6, paddingVertical: 12, paddingHorizontal: 14 }}>
      <HText size={15} color={Brand.white} style={{ lineHeight: 22 }} selectable>
        {text}
      </HText>
    </View>
  );
}

/**
 * Message vocal de l'utilisateur : bulle graphite de 236 px (bouton lecture blanc, forme d'onde dont la partie déjà lue est
 * blanche, durée) et la transcription dessous en italique.
 */
export function VoiceBubble({
  seed,
  durationMs,
  transcript,
  playing,
  progress,
  onToggle,
}: {
  seed: string;
  durationMs: number;
  transcript: string;
  playing: boolean;
  progress: number;
  onToggle: () => void;
}) {
  const { t } = useLanguage();
  const bars = voiceBars(seed);
  const done = Math.round(progress * bars.length);
  return (
    <View style={{ alignSelf: 'flex-end', alignItems: 'flex-end', gap: 6 }}>
      <View
        accessible
        accessibilityLabel={t('chat.voice.voiceMessage', { seconds: Math.max(1, Math.round(durationMs / 1000)) })}
        style={{ width: 236, backgroundColor: Brand.graphite, borderRadius: 20, borderBottomEndRadius: 6, paddingVertical: 10, paddingStart: 10, paddingEnd: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}
      >
        <Pressable onPress={onToggle} hitSlop={4} accessibilityRole="button" accessibilityLabel={t(playing ? 'chat.voice.pauseMessage' : 'chat.voice.play')} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Brand.white, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={playing ? 'pause' : 'play'} size={14} color={Brand.graphite} />
        </Pressable>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2, height: 28 }}>
          {bars.map((height, index) => (
            <View key={index} style={{ width: 3, borderRadius: 2, height, backgroundColor: index < done || (!playing && progress === 0 && index < 9) ? Brand.white : Palette.textSecondary }} />
          ))}
        </View>
        <HText size={12} color={Brand.mutedOnDark}>
          {formatDuration(durationMs)}
        </HText>
      </View>
      <HText size={12} color={Palette.textSecondary} style={{ fontStyle: 'italic', textAlign: 'right', maxWidth: 260 }}>
        {`« ${transcript} »`}
      </HText>
    </View>
  );
}

/** Séparateur de date centré (« AUJOURD'HUI · 15:42 »). */
export function DateSeparator({ label }: { label: string }) {
  return (
    <View style={{ alignSelf: 'center', backgroundColor: Palette.surface, borderRadius: 10, paddingVertical: 4, paddingHorizontal: 10 }}>
      <HText weight="semibold" size={11} track={0.1} color={Palette.textSecondary} style={{ lineHeight: 15 }}>
        {label.toLocaleUpperCase()}
      </HText>
    </View>
  );
}

const TONE_COLOR: Record<ChatCardItem['tone'], string> = {
  free: Palette.success,
  late: Palette.error,
  rented: Brand.graphite,
  pending: Brand.parcInspect,
};

/**
 * Carte de données dans la bulle : une ligne par véhicule ou location (point de statut, nom, détail, « Réserver → » / « Voir → »).
 * Les lignes viennent des résultats réels de l'agence, jamais du texte du modèle.
 */
export function DataCardView({ card, onOpen }: { card: ChatCard; onOpen: (item: ChatCardItem) => void }) {
  const { t, language } = useLanguage();
  const locale = language === 'ar' ? 'ar-MA' : 'fr-FR';
  return (
    <View style={{ backgroundColor: Palette.card, borderWidth: 1, borderColor: Palette.border, borderRadius: 14, overflow: 'hidden' }}>
      {card.items.map((item, index) => {
        const when = item.date ? new Date(item.date).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' }) : null;
        const detail = item.kind === 'vehicle' ? [item.plate, t('chat.convo.free')].filter(Boolean).join(' · ') : [item.customer, when].filter(Boolean).join(' · ');
        return (
          <Pressable
            key={item.id}
            onPress={() => onOpen(item)}
            accessibilityRole="button"
            accessibilityLabel={`${item.title}. ${detail}. ${t(item.kind === 'vehicle' ? 'chat.convo.book' : 'chat.convo.view')}`}
            style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: index === card.items.length - 1 ? 0 : 1, borderBottomColor: Palette.surfaceAlt }}
          >
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: TONE_COLOR[item.tone] }} />
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <HText weight="semibold" size={14} numberOfLines={1}>
                {item.title}
              </HText>
              {detail ? (
                <HText size={12} color={item.tone === 'late' ? Palette.error : Palette.textSecondary} numberOfLines={1}>
                  {detail}
                </HText>
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <HText weight="semibold" size={13}>
                {t(item.kind === 'vehicle' ? 'chat.convo.book' : 'chat.convo.view')}
              </HText>
              <ArrowIcon color={Palette.primary} size={15} />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Pastille d'action ronde de 32 px (copier) ou allongée (écouter), bordure `border`. */
export function SmallPill({ icon, label, onPress, a11yLabel, active = false }: { icon: keyof typeof Ionicons.glyphMap; label?: string; onPress: () => void; a11yLabel: string; active?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      style={{ height: 32, minWidth: 32, borderRadius: 16, borderWidth: 1, borderColor: Palette.border, backgroundColor: active ? Palette.surface : Palette.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: label ? 10 : 0 }}
    >
      <Ionicons name={icon} size={14} color={Brand.graphite} />
      {label ? (
        <HText weight="semibold" size={12}>
          {label}
        </HText>
      ) : null}
    </Pressable>
  );
}

/** Pastille de suggestion d'action sous une réponse (34 px). */
export function ActionPill({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
      <View style={{ height: 34, borderRadius: 17, borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.card, paddingHorizontal: 12, justifyContent: 'center' }}>
        <HText weight="medium" size={13} numberOfLines={1}>
          {label}
        </HText>
      </View>
    </Pressable>
  );
}

function Dot({ delay, shade }: { delay: number; shade: string }) {
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(progress, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(progress, { toValue: 0, duration: 320, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.delay(480 - delay),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [delay, progress]);
  return (
    <Animated.View
      style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: shade, opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }), transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }] }}
    />
  );
}

/** Réponse en cours d'écriture (flux) : avatar + bulle avec le texte déjà reçu. */
export function StreamingBubble({ text }: { text: string }) {
  return (
    <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
      <ChatAvatar />
      <View style={{ flex: 1, minWidth: 0, backgroundColor: Palette.surface, borderRadius: 20, borderBottomStartRadius: 6, padding: 12 }}>
        <HText size={15} style={{ lineHeight: 22, paddingHorizontal: 2 }}>
          {text}
        </HText>
      </View>
    </View>
  );
}

/** « BIBIP écrit » : avatar + bulle avec trois points animés. */
export function TypingBubble() {
  const { t } = useLanguage();
  return (
    <View accessible accessibilityLabel={t('chat.convo.typing')} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
      <ChatAvatar />
      <View style={{ backgroundColor: Palette.surface, borderRadius: 20, borderBottomStartRadius: 6, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', gap: 5 }}>
        <Dot delay={0} shade={Palette.textSecondary} />
        <Dot delay={160} shade={Palette.textMuted} />
        <Dot delay={320} shade={Brand.mutedOnDark} />
      </View>
    </View>
  );
}

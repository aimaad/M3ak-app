import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { M3akPalette, Shadows } from '@/constants/theme';

import type { ChatMessage } from './types';

/** Pastille M3ak : violet vif avec une étincelle, reconnaissable d'un coup d'œil. */
export function ChatAvatar({ size = 32 }: { size?: number }) {
  return (
    <View
      className="items-center justify-center rounded-full"
      style={{ width: size, height: size, backgroundColor: M3akPalette.mauve, ...Shadows.button, shadowOpacity: 0.25 }}
    >
      <Ionicons name="sparkles" size={Math.round(size * 0.5)} color="#FFFFFF" />
    </View>
  );
}

function formatTime(iso: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Bulle de conversation. Les coins « côté auteur » sont plus serrés (effet de queue) ; les couleurs sont imposées
 * (texte blanc sur violet, texte foncé sur blanc) pour rester lisibles quel que soit le thème du téléphone.
 */
export function ChatBubble({ message, onOpenSource }: { message: ChatMessage; onOpenSource: (rentalId: string) => void }) {
  const mine = message.role === 'user';
  const time = formatTime(message.createdAt);

  return (
    <View className={`max-w-[92%] flex-row gap-2 ${mine ? 'items-end self-end' : 'items-start self-start'}`}>
      {mine ? null : <ChatAvatar size={30} />}
      <View className="flex-shrink gap-1.5">
        <View
          style={[
            {
              backgroundColor: mine ? M3akPalette.mauve : '#FFFFFF',
              borderWidth: mine ? 0 : 1,
              borderColor: M3akPalette.border,
              borderRadius: 20,
              paddingHorizontal: 16,
              paddingVertical: 12,
            },
            mine ? { borderBottomEndRadius: 6, ...Shadows.button, shadowOpacity: 0.22 } : { borderBottomStartRadius: 6, ...Shadows.card },
          ]}
        >
          <ThemedText type="default" style={{ color: mine ? '#FFFFFF' : M3akPalette.ink }} selectable>
            {message.content}
          </ThemedText>
        </View>

        {!mine && message.sources.length > 0 ? (
          <View className="flex-row flex-wrap gap-2">
            {message.sources.map((source) => (
              <Pressable
                key={source.id}
                onPress={() => onOpenSource(source.id)}
                accessibilityRole="button"
                className="min-h-8 flex-row items-center gap-1.5 rounded-full border border-line bg-brand-soft px-3 py-1.5"
              >
                <Ionicons name="document-text-outline" size={14} color={M3akPalette.mauveDeep} />
                <ThemedText type="small" style={{ color: M3akPalette.mauveDeep, fontSize: 12, fontWeight: '600' }} numberOfLines={1}>
                  {source.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        ) : null}

        {time ? (
          <ThemedText type="small" style={{ color: M3akPalette.subtle, fontSize: 11 }} className={mine ? 'self-end' : 'self-start'}>
            {time}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}

function Dot({ delay }: { delay: number }) {
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
      style={{
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: M3akPalette.mauve,
        opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
        transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
      }}
    />
  );
}

/** « M3ak écrit… » : trois points animés dans une bulle, avec le texte d'état à côté. */
export function TypingBubble({ label }: { label: string }) {
  return (
    <View className="max-w-[92%] flex-row items-end gap-2 self-start">
      <ChatAvatar size={30} />
      <View
        className="flex-row items-center gap-3 border border-line bg-white px-4 py-3"
        style={{ borderRadius: 20, borderBottomStartRadius: 6, ...Shadows.card }}
      >
        <View className="flex-row items-center gap-1.5">
          <Dot delay={0} />
          <Dot delay={160} />
          <Dot delay={320} />
        </View>
        <ThemedText type="small" style={{ color: M3akPalette.muted }}>
          {label}
        </ThemedText>
      </View>
    </View>
  );
}

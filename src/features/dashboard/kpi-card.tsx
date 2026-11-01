import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { M3akPalette } from '@/constants/theme';

import { GlassCard } from './home-cards';

type Tone = 'default' | 'good' | 'warning' | 'danger';

/** Couleur de l'icône (et de la valeur quand le ton signale quelque chose) ; l'état n'est jamais porté par la couleur seule : icône + intitulé. */
const TONE_COLOR: Record<Tone, string> = {
  default: M3akPalette.mauve,
  good: M3akPalette.success,
  warning: M3akPalette.warning,
  danger: M3akPalette.danger,
};

/** Texte de la valeur : variantes foncées des couleurs fonctionnelles (4,5:1 sur blanc). */
const TONE_TEXT: Record<Tone, string> = {
  default: M3akPalette.ink,
  good: M3akPalette.successText,
  warning: M3akPalette.warningText,
  danger: M3akPalette.dangerText,
};

const TONE_TINT: Record<Tone, string> = {
  default: M3akPalette.mauveLight,
  good: M3akPalette.successLight,
  warning: M3akPalette.warningLight,
  danger: M3akPalette.dangerLight,
};

/**
 * Carte de statistique : icône dans une pastille teintée, valeur en grand, intitulé, précision facultative.
 * Appuyable si `onPress` est fourni.
 */
export function KpiCard({
  label,
  value,
  hint,
  tone = 'default',
  onPress,
  wide,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
  onPress?: () => void;
  wide?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const content = (
    <View className="gap-3">
      {icon ? (
        <View
          className="h-10 w-10 items-center justify-center rounded-full"
          style={{ backgroundColor: TONE_TINT[tone] }}
        >
          <Ionicons name={icon} size={20} color={TONE_COLOR[tone]} />
        </View>
      ) : null}
      <View className="gap-0.5">
        <ThemedText
          type="subtitle"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          style={{ fontSize: 22, lineHeight: 28, color: TONE_TEXT[tone] }}
        >
          {value}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
        {hint ? (
          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={{ fontSize: 12, lineHeight: 16 }}
          >
            {hint}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
  const width = wide ? 'w-full' : 'w-[47%]';
  // Même carte « verre » que les compteurs de l'accueil : dégradé blanc-lavande, liseré clair, ombre lavande.
  return (
    <View className={width}>
      <GlassCard onPress={onPress} label={onPress ? `${label} : ${value}` : undefined}>
        <View className="p-4">{content}</View>
      </GlassCard>
    </View>
  );
}

export function KpiGrid({ children }: { children: React.ReactNode }) {
  return <View className="flex-row flex-wrap gap-3">{children}</View>;
}

export function SectionTitle({ children }: { children: string }) {
  return (
    <ThemedText
      type="smallBold"
      style={{ fontSize: 18, lineHeight: 26 }}
      accessibilityRole="header"
    >
      {children}
    </ThemedText>
  );
}

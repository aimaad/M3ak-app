import { View } from 'react-native';

import { Card, PressableCard } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { M3akPalette } from '@/constants/theme';

type Tone = 'default' | 'good' | 'warning' | 'danger';

const TONE_COLOR: Record<Tone, string> = {
  default: M3akPalette.mauve,
  good: M3akPalette.success,
  warning: M3akPalette.warning,
  danger: M3akPalette.danger,
};

/** Une tuile d'indicateur : valeur en grand, intitulé, précision facultative. Appuyable si `onPress` est fourni. */
export function KpiCard({
  label,
  value,
  hint,
  tone = 'default',
  onPress,
  wide,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
  onPress?: () => void;
  wide?: boolean;
}) {
  const content = (
    <View className="gap-1">
      <ThemedText type="subtitle" className="font-cairo-semibold" style={{ color: TONE_COLOR[tone] }}>
        {value}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      {hint ? (
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
  const width = wide ? 'w-full' : 'w-[47%]';
  return onPress ? (
    <PressableCard onPress={onPress} className={width}>
      {content}
    </PressableCard>
  ) : (
    <Card className={width}>{content}</Card>
  );
}

export function KpiGrid({ children }: { children: React.ReactNode }) {
  return <View className="flex-row flex-wrap gap-3">{children}</View>;
}

export function SectionTitle({ children }: { children: string }) {
  return <ThemedText type="smallBold">{children}</ThemedText>;
}

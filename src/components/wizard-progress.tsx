import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { M3akPalette } from '@/constants/theme';

type Props = {
  /** Étape affichée, à partir de 0. */
  current: number;
  total: number;
  title: string;
  stepLabel: string;
};

/** Barre d'avancement d'un assistant : « Étape 2 sur 6 », titre de l'étape et une pastille par étape. */
export function WizardProgress({ current, total, title, stepLabel }: Props) {
  return (
    <View className="gap-2 px-6 pb-3">
      <View className="flex-row items-center justify-between">
        <ThemedText type="small" themeColor="textSecondary">
          {stepLabel}
        </ThemedText>
        <ThemedText type="smallBold">{title}</ThemedText>
      </View>
      <View className="flex-row gap-1.5">
        {Array.from({ length: total }, (_, index) => (
          <View
            key={index}
            className="h-1.5 flex-1 rounded-full"
            style={{ backgroundColor: index <= current ? M3akPalette.mauve : '#EAE5F2' }}
          />
        ))}
      </View>
    </View>
  );
}

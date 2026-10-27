import type { ReactNode } from 'react';
import { I18nManager, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

type InfoRowProps = {
  label: string;
  value: ReactNode;
  /** Dernière ligne d'une carte : pas de filet en dessous. */
  last?: boolean;
};

/**
 * Ligne « libellé : valeur » des fiches. Le libellé se réduit (jamais plus de 45 % de la largeur), la valeur prend le reste
 * et passe à la ligne si elle est longue ; 16 px les séparent toujours, donc rien ne se colle ni ne se superpose.
 * L'alignement est logique (début / fin) : la ligne se retourne toute seule en arabe.
 */
export function InfoRow({ label, value, last }: InfoRowProps) {
  return (
    <View className={`flex-row items-start gap-4 py-3 ${last ? '' : 'border-b border-[#E4DCF5]'}`}>
      <ThemedText type="default" themeColor="textSecondary" style={{ flexShrink: 1, maxWidth: '45%' }}>
        {label}
      </ThemedText>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        {typeof value === 'string' || typeof value === 'number' ? (
          <ThemedText type="smallBold" style={{ flexShrink: 1, textAlign: I18nManager.isRTL ? 'left' : 'right' }}>
            {value}
          </ThemedText>
        ) : (
          value
        )}
      </View>
    </View>
  );
}

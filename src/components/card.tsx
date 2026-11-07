import { Pressable, View, type PressableProps, type ViewProps } from 'react-native';

import { Shadows } from '@/constants/theme';

type CardProps = ViewProps & {
  padded?: boolean;
  /** `forest` : carte vedette vert profond (revenus, bandeaux de marque). */
  variant?: 'default' | 'forest';
};

/** Surface blanche (ou vert forêt en variante vedette), bords arrondis, ombre très légère. */
export function Card({ padded = true, variant = 'default', className, style, ...rest }: CardProps) {
  const surface = variant === 'forest' ? 'rounded-3xl bg-graphite' : 'rounded-2xl border border-border bg-card';
  return (
    <View
      className={`${surface} ${padded ? 'p-4' : ''} ${className ?? ''}`}
      style={[variant === 'forest' ? Shadows.raised : Shadows.card, style]}
      {...rest}
    />
  );
}

type PressableCardProps = PressableProps & {
  padded?: boolean;
};

export function PressableCard({ padded = true, className, ...rest }: PressableCardProps) {
  return (
    <Pressable
      className={`rounded-2xl border border-border bg-card active:bg-primary-soft ${padded ? 'p-4' : ''} ${className ?? ''}`}
      style={Shadows.card}
      {...rest}
    />
  );
}

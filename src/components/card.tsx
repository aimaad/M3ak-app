import { Pressable, View, type PressableProps, type ViewProps } from 'react-native';

import { Shadows } from '@/constants/theme';

type CardProps = ViewProps & {
  padded?: boolean;
};

/** Surface blanche, bords arrondis et ombre douce teintée de violet. */
export function Card({ padded = true, className, style, ...rest }: CardProps) {
  return (
    <View
      className={`rounded-3xl border border-[#E4DCF5] bg-white ${padded ? 'p-4' : ''} ${className ?? ''}`}
      style={[Shadows.card, style]}
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
      className={`rounded-3xl border border-[#E4DCF5] bg-white active:bg-[#F5F0FF] ${padded ? 'p-4' : ''} ${className ?? ''}`}
      style={Shadows.card}
      {...rest}
    />
  );
}

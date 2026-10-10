import { Pressable, View, type PressableProps, type ViewProps } from 'react-native';

type CardProps = ViewProps & {
  padded?: boolean;
};

export function Card({ padded = true, className, ...rest }: CardProps) {
  return (
    <View
      className={`rounded-3xl border border-[#EAE5F2] bg-white ${padded ? 'p-4' : ''} ${className ?? ''}`}
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
      className={`rounded-3xl border border-[#EAE5F2] bg-white active:bg-[#FAF9FF] ${padded ? 'p-4' : ''} ${className ?? ''}`}
      {...rest}
    />
  );
}

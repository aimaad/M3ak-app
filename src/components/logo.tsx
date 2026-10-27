import { Text, View } from 'react-native';

import { M3akPalette } from '@/constants/theme';

type LogoProps = {
  variant?: 'mauve' | 'white';
  size?: 'md' | 'lg';
};

export function Logo({ variant = 'mauve', size = 'md' }: LogoProps) {
  const mainColor = variant === 'white' ? '#FFFFFF' : M3akPalette.mauve;
  const labelColor = variant === 'white' ? 'rgba(255,255,255,0.72)' : '#5E5575';
  const mainSize = size === 'lg' ? 40 : 24;
  const labelSize = size === 'lg' ? 13 : 10;

  return (
    <View className="flex-row items-baseline gap-1.5">
      <Text
        style={{ fontFamily: 'Cairo_700Bold', fontSize: mainSize, lineHeight: mainSize * 1.1, color: mainColor }}
      >
        M3
      </Text>
      <Text
        style={{
          fontFamily: 'Cairo_600SemiBold',
          fontSize: labelSize,
          letterSpacing: 1.5,
          color: labelColor,
          textTransform: 'uppercase',
        }}
      >
        de
      </Text>
      <Text
        style={{ fontFamily: 'Cairo_700Bold', fontSize: mainSize, lineHeight: mainSize * 1.1, color: mainColor }}
      >
        M3ak
      </Text>
    </View>
  );
}

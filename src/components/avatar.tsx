import { Image, View } from 'react-native';

import { MEMBER_AVATARS_BUCKET } from '@/features/agency/api';
import { useSignedUrl } from '@/features/storage/hooks';
import { M3akPalette } from '@/constants/theme';

import { ThemedText } from './themed-text';

type AvatarProps = {
  path: string | null | undefined;
  size?: number;
  initials?: string;
};

export function Avatar({ path, size = 40, initials }: AvatarProps) {
  const { data: signedUrl } = useSignedUrl(MEMBER_AVATARS_BUCKET, path ?? undefined);

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        backgroundColor: M3akPalette.mauveLight,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {signedUrl ? (
        <Image source={{ uri: signedUrl }} style={{ width: size, height: size }} resizeMode="cover" />
      ) : (
        <ThemedText type="smallBold" themeColor="primary" style={{ fontSize: size * 0.4 }}>
          {initials ?? '?'}
        </ThemedText>
      )}
    </View>
  );
}

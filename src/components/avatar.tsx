import { Image, View } from 'react-native';

import { MEMBER_AVATARS_BUCKET } from '@/features/agency/api';
import { useSignedUrl } from '@/features/storage/hooks';
import { Brand, HomeFonts, Palette } from '@/constants/theme';

import { ThemedText } from './themed-text';

type AvatarProps = {
  path: string | null | undefined;
  size?: number;
  initials?: string;
  /** `onDark` : fond graphite, initiales blanches (en-tête de l'accueil). */
  tone?: 'default' | 'onDark';
};

export function Avatar({ path, size = 40, initials, tone = 'default' }: AvatarProps) {
  const { data: signedUrl } = useSignedUrl(MEMBER_AVATARS_BUCKET, path ?? undefined);

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        backgroundColor: tone === 'onDark' ? Brand.surfaceOnDark : Palette.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {signedUrl ? (
        <Image source={{ uri: signedUrl }} style={{ width: size, height: size }} resizeMode="cover" />
      ) : (
        <ThemedText
          type="smallBold"
          themeColor="primary"
          style={
            tone === 'onDark'
              ? { fontSize: 13, lineHeight: 18, color: Brand.white, fontFamily: HomeFonts.text.semibold, letterSpacing: 0.5 }
              : { fontSize: size * 0.4 }
          }
        >
          {initials ?? '?'}
        </ThemedText>
      )}
    </View>
  );
}

import { ActivityIndicator, Image, View } from 'react-native';

import { useSignedUrl } from '@/features/storage/hooks';

import { ThemedText } from './themed-text';
import { M3akPalette } from '@/constants/theme';

type DocumentPreviewProps = {
  label: string;
  bucket: string;
  path?: string;
  emptyLabel: string;
};

export function DocumentPreview({ label, bucket, path, emptyLabel }: DocumentPreviewProps) {
  const { data: signedUrl, isLoading } = useSignedUrl(bucket, path);

  return (
    <View className="gap-2">
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      {!path ? (
        <View className="h-24 items-center justify-center rounded-2xl border border-dashed border-line bg-white">
          <ThemedText type="small" themeColor="textSecondary">
            {emptyLabel}
          </ThemedText>
        </View>
      ) : isLoading || !signedUrl ? (
        <View className="h-36 items-center justify-center rounded-2xl bg-canvas">
          <ActivityIndicator color={M3akPalette.mauve} />
        </View>
      ) : (
        <View className="h-36 w-full overflow-hidden rounded-2xl">
          <Image source={{ uri: signedUrl }} style={{ position: 'absolute', width: '100%', height: '100%' }} resizeMode="cover" />
        </View>
      )}
    </View>
  );
}

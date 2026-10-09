import { ActivityIndicator, Image, View } from 'react-native';

import { useSignedUrl } from '@/features/storage/hooks';

import { ThemedText } from './themed-text';

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
        <View className="h-24 items-center justify-center rounded-2xl border border-dashed border-[#e1e5f0] bg-white">
          <ThemedText type="small" themeColor="textSecondary">
            {emptyLabel}
          </ThemedText>
        </View>
      ) : isLoading || !signedUrl ? (
        <View className="h-36 items-center justify-center rounded-2xl bg-[#f4f6fb]">
          <ActivityIndicator color="#1f5eff" />
        </View>
      ) : (
        <Image source={{ uri: signedUrl }} className="h-36 w-full rounded-2xl" resizeMode="cover" />
      )}
    </View>
  );
}

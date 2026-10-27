import { Image, Pressable, ScrollView, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useSignedUrl } from '@/features/storage/hooks';

import { VEHICLE_PHOTOS_BUCKET } from './api';
import type { VehiclePhoto } from './types';

function GalleryThumbnail({
  photo,
  canDelete,
  onDelete,
}: {
  photo: VehiclePhoto;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const { data: signedUrl } = useSignedUrl(VEHICLE_PHOTOS_BUCKET, photo.path);

  return (
    <View className="relative">
      {signedUrl ? (
        <Image source={{ uri: signedUrl }} className="h-28 w-28 rounded-2xl" resizeMode="cover" />
      ) : (
        <View className="h-28 w-28 rounded-2xl bg-[#FAF9FF]" />
      )}
      {canDelete ? (
        <Pressable
          onPress={onDelete}
          className="absolute -right-1 -top-1 h-6 w-6 items-center justify-center rounded-full bg-[#211A2E]"
        >
          <ThemedText type="small" style={{ color: '#ffffff' }}>
            ×
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

export function VehiclePhotoGallery({
  photos,
  canDelete,
  onDelete,
  emptyLabel,
}: {
  photos: VehiclePhoto[];
  canDelete: boolean;
  onDelete: (photo: VehiclePhoto) => void;
  emptyLabel: string;
}) {
  if (photos.length === 0) {
    return (
      <View className="h-24 items-center justify-center rounded-2xl border border-dashed border-[#E4DCF5] bg-white">
        <ThemedText type="small" themeColor="textSecondary">
          {emptyLabel}
        </ThemedText>
      </View>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
      {photos.map((photo) => (
        <GalleryThumbnail key={photo.path} photo={photo} canDelete={canDelete} onDelete={() => onDelete(photo)} />
      ))}
    </ScrollView>
  );
}

import * as ImagePicker from 'expo-image-picker';
import { Image, Pressable, ScrollView, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useLanguage } from '@/i18n/use-language';

type VehiclePhotoPickerProps = {
  label: string;
  localUris: string[];
  onAdd: (uri: string) => void;
  onRemove: (uri: string) => void;
};

async function pickFromLibrary(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
  return result.canceled ? null : (result.assets[0]?.uri ?? null);
}

async function pickFromCamera(): Promise<string | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
  return result.canceled ? null : (result.assets[0]?.uri ?? null);
}

export function VehiclePhotoPicker({ label, localUris, onAdd, onRemove }: VehiclePhotoPickerProps) {
  const { t } = useLanguage();

  async function handlePick(source: 'library' | 'camera') {
    const uri = source === 'library' ? await pickFromLibrary() : await pickFromCamera();
    if (uri) onAdd(uri);
  }

  return (
    <View className="gap-2">
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>

      {localUris.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
          {localUris.map((uri) => (
            <View key={uri} className="relative">
              <Image source={{ uri }} className="h-24 w-24 rounded-2xl" resizeMode="cover" />
              <Pressable
                onPress={() => onRemove(uri)}
                className="absolute -right-1 -top-1 h-6 w-6 items-center justify-center rounded-full bg-[#101423]"
              >
                <ThemedText type="small" style={{ color: '#ffffff' }}>
                  ×
                </ThemedText>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : null}

      <View className="flex-row gap-2">
        <Pressable
          onPress={() => handlePick('camera')}
          className="flex-1 items-center rounded-2xl border border-[#e1e5f0] bg-white px-4 py-3"
        >
          <ThemedText type="small">{t('common.camera')}</ThemedText>
        </Pressable>
        <Pressable
          onPress={() => handlePick('library')}
          className="flex-1 items-center rounded-2xl border border-[#e1e5f0] bg-white px-4 py-3"
        >
          <ThemedText type="small">{t('common.gallery')}</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

import * as ImagePicker from 'expo-image-picker';
import { Image, Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useLanguage } from '@/i18n/use-language';

import { useDocumentSignedUrl } from './hooks';

type DocumentPhotoFieldProps = {
  label: string;
  localUri: string | null;
  existingPath?: string;
  onPick: (uri: string) => void;
};

async function pickFromLibrary(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.7,
  });
  return result.canceled ? null : (result.assets[0]?.uri ?? null);
}

async function pickFromCamera(): Promise<string | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
  return result.canceled ? null : (result.assets[0]?.uri ?? null);
}

export function DocumentPhotoField({ label, localUri, existingPath, onPick }: DocumentPhotoFieldProps) {
  const { t } = useLanguage();
  const { data: signedUrl } = useDocumentSignedUrl(localUri ? undefined : existingPath);
  const previewUri = localUri ?? signedUrl;

  async function handlePick(source: 'library' | 'camera') {
    const uri = source === 'library' ? await pickFromLibrary() : await pickFromCamera();
    if (uri) onPick(uri);
  }

  return (
    <View className="gap-1.5">
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      {previewUri ? (
        <Image source={{ uri: previewUri }} className="h-36 w-full rounded-2xl" resizeMode="cover" />
      ) : null}
      <View className="flex-row gap-2">
        <Pressable
          onPress={() => handlePick('camera')}
          className="flex-1 items-center rounded-2xl border border-[#e1e5f0] bg-white px-4 py-3"
        >
          <ThemedText type="small">{t('customer.documents.camera')}</ThemedText>
        </Pressable>
        <Pressable
          onPress={() => handlePick('library')}
          className="flex-1 items-center rounded-2xl border border-[#e1e5f0] bg-white px-4 py-3"
        >
          <ThemedText type="small">{t('customer.documents.gallery')}</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

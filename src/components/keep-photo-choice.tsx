import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { M3akPalette } from '@/constants/theme';
import { useLanguage } from '@/i18n/use-language';

import { ThemedText } from './themed-text';

/**
 * Choix explicite : conserver ou non la photo du document dans le dossier (envoi sécurisé au backend M3AK).
 * Décoché, la photo reste sur l'appareil et n'est jamais téléversée ; seules les informations validées sont enregistrées.
 */
export function KeepPhotoChoice({ value, onChange }: { value: boolean; onChange: (next: boolean) => void }) {
  const { t } = useLanguage();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      className="flex-row items-start gap-3 rounded-2xl bg-[#FAF9FF] px-4 py-3">
      <Ionicons name={value ? 'checkbox' : 'square-outline'} size={22} color={M3akPalette.mauve} />
      <View className="flex-1 gap-1">
        <ThemedText type="smallBold">{t('ocr.keepPhoto.label')}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {value ? t('ocr.keepPhoto.on') : t('ocr.keepPhoto.off')}
        </ThemedText>
      </View>
    </Pressable>
  );
}

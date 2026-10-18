import { useState } from 'react';
import { Image, Modal, Platform, Pressable, ScrollView, StatusBar, useWindowDimensions, View, type StyleProp, type ImageStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useLanguage } from '@/i18n/use-language';

type Props = { uri: string; style?: StyleProp<ImageStyle>; label?: string };

/** Miniature qui s'ouvre en plein écran au toucher ; pincer pour zoomer (iOS), toucher « Fermer » pour revenir. */
export function ZoomableImage({ uri, style, label }: Props) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Dans un Modal les marges de sécurité peuvent être à 0 : on garde un minimum pour passer sous l'heure et la batterie.
  const topInset = Math.max(insets.top, Platform.OS === 'ios' ? 54 : (StatusBar.currentHeight ?? 24) + 8);
  const bottomInset = Math.max(insets.bottom, 16);

  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="imagebutton" accessibilityLabel={label ?? t('common.zoomHint')} style={{ flex: 1 }}>
        <Image source={{ uri }} style={[{ width: '100%', height: '100%' }, style]} resizeMode="cover" />
        <View className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5">
          <ThemedText type="small" style={{ color: '#fff' }}>
            🔍
          </ThemedText>
        </View>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' }}>
          <View style={{ flex: 1, paddingTop: topInset, paddingBottom: bottomInset }}>
            <View className="flex-row items-center justify-between px-5 pb-3">
              <ThemedText type="smallBold" style={{ color: '#fff' }}>
                {label ?? ''}
              </ThemedText>
              <Pressable onPress={() => setOpen(false)} className="rounded-full bg-white/20 px-4 py-2" accessibilityRole="button">
                <ThemedText type="smallBold" style={{ color: '#fff' }}>
                  {t('common.close')}
                </ThemedText>
              </Pressable>
            </View>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
              minimumZoomScale={1}
              maximumZoomScale={4}
              centerContent
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
            >
              <Pressable onPress={() => setOpen(false)}>
                <Image source={{ uri }} style={{ width, height: height * 0.75 }} resizeMode="contain" />
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

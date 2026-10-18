import { useEffect, useState } from 'react';
import { Image, Modal, Platform, Pressable, ScrollView, StatusBar, useWindowDimensions, View, type StyleProp, type ImageStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useLanguage } from '@/i18n/use-language';

/** Cadre posé sur l'image, coordonnées relatives (0 à 1) ; `label` = petit numéro affiché sur le cadre. */
export type ImageBox = { x: number; y: number; w: number; h: number; label?: string; color?: string };

type Props = { uri: string; style?: StyleProp<ImageStyle>; label?: string; boxes?: ImageBox[] };

/** Proportions (largeur / hauteur) d'une image distante ou locale, null tant qu'elles ne sont pas connues. */
export function useImageRatio(uri: string | undefined): number | null {
  const [ratio, setRatio] = useState<number | null>(null);
  useEffect(() => {
    if (!uri) return;
    let active = true;
    Image.getSize(
      uri,
      (width, height) => {
        if (active && width > 0 && height > 0) setRatio(width / height);
      },
      () => undefined
    );
    return () => {
      active = false;
    };
  }, [uri]);
  return ratio;
}

function Boxes({ boxes }: { boxes: ImageBox[] }) {
  return (
    <>
      {boxes.map((box, index) => (
        <View
          key={index}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: `${box.x * 100}%`,
            top: `${box.y * 100}%`,
            width: `${box.w * 100}%`,
            height: `${box.h * 100}%`,
            borderWidth: 2,
            borderColor: box.color ?? '#DC2626',
            borderRadius: 4,
          }}
        >
          {box.label ? (
            <View style={{ position: 'absolute', top: -10, left: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: box.color ?? '#DC2626', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
              <ThemedText type="small" style={{ color: '#fff', fontSize: 11, lineHeight: 14 }}>
                {box.label}
              </ThemedText>
            </View>
          ) : null}
        </View>
      ))}
    </>
  );
}

/**
 * Miniature qui s'ouvre en plein écran au toucher ; pincer pour zoomer (iOS), toucher « Fermer » pour revenir.
 * Avec `boxes`, les cadres des dommages sont dessinés sur la miniature ET sur la photo agrandie.
 */
export function ZoomableImage({ uri, style, label, boxes }: Props) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const ratio = useImageRatio(boxes && boxes.length > 0 ? uri : undefined);
  // Dans un Modal les marges de sécurité peuvent être à 0 : on garde un minimum pour passer sous l'heure et la batterie.
  const topInset = Math.max(insets.top, Platform.OS === 'ios' ? 54 : (StatusBar.currentHeight ?? 24) + 8);
  const bottomInset = Math.max(insets.bottom, 16);

  const maxHeight = height * 0.75;
  const fullWidth = ratio ? Math.min(width, maxHeight * ratio) : width;
  const fullHeight = ratio ? fullWidth / ratio : maxHeight;

  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="imagebutton" accessibilityLabel={label ?? t('common.zoomHint')} style={{ flex: 1 }}>
        {boxes && boxes.length > 0 && ratio ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000', borderRadius: 16, overflow: 'hidden' }}>
            <View style={{ height: '100%', aspectRatio: ratio, maxWidth: '100%' }}>
              <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="stretch" />
              <Boxes boxes={boxes} />
            </View>
          </View>
        ) : (
          <Image source={{ uri }} style={[{ width: '100%', height: '100%' }, style]} resizeMode="cover" />
        )}
        <View className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5">
          <ThemedText type="small" style={{ color: '#fff' }}>
            🔍
          </ThemedText>
        </View>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', paddingTop: topInset, paddingBottom: bottomInset }}>
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
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}
            minimumZoomScale={1}
            maximumZoomScale={4}
            centerContent
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
          >
            <Pressable onPress={() => setOpen(false)}>
              <View style={{ width: fullWidth, height: fullHeight }}>
                <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode={ratio ? 'stretch' : 'contain'} />
                {boxes && ratio ? <Boxes boxes={boxes} /> : null}
              </View>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

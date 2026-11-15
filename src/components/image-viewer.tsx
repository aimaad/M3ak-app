import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Image, Modal, Platform, Pressable, ScrollView, StatusBar, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand, Palette } from '@/constants/theme';
import { HText } from '@/features/dashboard/home-ui';
import { useLanguage } from '@/i18n/use-language';

const LEVELS = [1, 2, 3, 4] as const;

/**
 * Visionneuse plein écran d'une photo de document : on agrandit avec « + » / « − » (partout) ou en pinçant (iOS), puis on fait glisser la photo
 * dans les deux sens. Un indicateur tourne tant que la photo se charge.
 */
export function ImageViewer({ uri, label, onClose }: { uri: string | null; label: string; onClose: () => void }) {
  const { t } = useLanguage();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [level, setLevel] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const topInset = Math.max(insets.top, Platform.OS === 'ios' ? 54 : (StatusBar.currentHeight ?? 24) + 8);
  const scale = LEVELS[level];
  const viewHeight = height * 0.72;

  function close() {
    setLevel(0);
    setLoaded(false);
    onClose();
  }

  return (
    <Modal visible={uri !== null} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: Palette.overlay, paddingTop: topInset, paddingBottom: Math.max(insets.bottom, 16) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 10, gap: 12 }}>
          <HText weight="semibold" size={15} color={Brand.white} style={{ flexShrink: 1 }} numberOfLines={1}>
            {label}
          </HText>
          <Pressable onPress={close} accessibilityRole="button" accessibilityLabel={t('common.close')} style={{ minHeight: 44, paddingHorizontal: 18, borderRadius: 22, backgroundColor: Brand.white, justifyContent: 'center' }}>
            <HText weight="semibold" size={14}>
              {t('common.close')}
            </HText>
          </Pressable>
        </View>

        <View style={{ flex: 1 }}>
          {uri ? (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }} maximumZoomScale={4} minimumZoomScale={1} bouncesZoom centerContent showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} nestedScrollEnabled>
              <ScrollView horizontal nestedScrollEnabled contentContainerStyle={{ alignItems: 'center', justifyContent: 'center', minWidth: width }} showsHorizontalScrollIndicator={false}>
                <Image source={{ uri }} accessibilityLabel={label} onLoad={() => setLoaded(true)} fadeDuration={0} style={{ width: width * scale, height: viewHeight * scale }} resizeMode="contain" />
              </ScrollView>
            </ScrollView>
          ) : null}
          {uri && !loaded ? (
            <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={Brand.white} size="large" />
            </View>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, paddingTop: 12 }}>
          <Pressable onPress={() => setLevel((value) => Math.max(0, value - 1))} disabled={level === 0} accessibilityRole="button" accessibilityLabel={t('common.zoomOut')} accessibilityState={{ disabled: level === 0 }} style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: Brand.white, alignItems: 'center', justifyContent: 'center', opacity: level === 0 ? 0.4 : 1 }}>
            <Ionicons name="remove" size={26} color={Brand.graphite} />
          </Pressable>
          <HText weight="bold" size={15} color={Brand.white} style={{ minWidth: 52, textAlign: 'center' }}>
            {`${scale * 100} %`}
          </HText>
          <Pressable onPress={() => setLevel((value) => Math.min(LEVELS.length - 1, value + 1))} disabled={level === LEVELS.length - 1} accessibilityRole="button" accessibilityLabel={t('common.zoomIn')} accessibilityState={{ disabled: level === LEVELS.length - 1 }} style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: Brand.white, alignItems: 'center', justifyContent: 'center', opacity: level === LEVELS.length - 1 ? 0.4 : 1 }}>
            <Ionicons name="add" size={26} color={Brand.graphite} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRef, useState } from 'react';
import { Modal, Pressable, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand } from '@/constants/theme';
import { HText } from '@/features/dashboard/home-ui';
// Cadre au format carte de l'ajout de véhicule : import en lecture seule, sans modification de ce fichier.
import { ScanFrame } from '@/features/vehicles/add/scan-parts';
import { useLanguage } from '@/i18n/use-language';

/**
 * Caméra plein écran avec le cadre du document : un seul geste « Scanner » ouvre ceci ; la galerie est proposée ICI (bouton en bas à gauche),
 * pas par un second bouton sous chaque case. Renvoie l'adresse de la photo (prise ou choisie), ou rien si on ferme.
 */
export function CameraCapture({ visible, onClose, onCapture, hint }: { visible: boolean; onClose: () => void; onCapture: (uri: string) => void; hint?: string }) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false);
  const frameWidth = Math.min(width - 48, 360);

  async function shoot() {
    if (busy) return;
    setBusy(true);
    try {
      const photo = await camera.current?.takePictureAsync({ quality: 0.8 });
      if (photo?.uri) onCapture(photo.uri);
    } finally {
      setBusy(false);
    }
  }

  async function gallery() {
    const granted = (await ImagePicker.requestMediaLibraryPermissionsAsync()).granted;
    if (!granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]?.uri) onCapture(result.assets[0].uri);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: Brand.scannerBackground }}>
        {permission?.granted ? <CameraView ref={camera} style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 }} facing="back" /> : null}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          {permission?.granted ? (
            <>
              <ScanFrame width={frameWidth} height={frameWidth / 1.586} />
              <HText size={13} color={Brand.white}>
                {hint ?? t('form.camera.hint')}
              </HText>
            </>
          ) : (
            <View style={{ alignItems: 'center', gap: 16, padding: 32 }}>
              <HText size={15} color={Brand.white} style={{ textAlign: 'center' }}>
                {t('form.camera.permission')}
              </HText>
              <Pressable onPress={() => void requestPermission()} accessibilityRole="button" style={{ minHeight: 48, borderRadius: 24, paddingHorizontal: 24, backgroundColor: Brand.orange, justifyContent: 'center' }}>
                <HText weight="semibold" size={14} color={Brand.white}>
                  {t('form.camera.allow')}
                </HText>
              </Pressable>
            </View>
          )}
        </View>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('form.close')} style={{ position: 'absolute', top: insets.top + 8, end: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: Brand.graphite, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="close" size={20} color={Brand.white} />
        </Pressable>
        <View style={{ position: 'absolute', start: 0, end: 0, bottom: insets.bottom + 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 32 }}>
          <Pressable onPress={() => void gallery()} accessibilityRole="button" accessibilityLabel={t('form.camera.gallery')} style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: Brand.graphite, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="images-outline" size={24} color={Brand.white} />
          </Pressable>
          <Pressable onPress={() => void shoot()} disabled={!permission?.granted || busy} accessibilityRole="button" accessibilityLabel={t('form.camera.shoot')} style={{ width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: Brand.white, alignItems: 'center', justifyContent: 'center', opacity: permission?.granted ? 1 : 0.4 }}>
            <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: Brand.white }} />
          </Pressable>
          <View style={{ width: 56 }} />
        </View>
      </View>
    </Modal>
  );
}

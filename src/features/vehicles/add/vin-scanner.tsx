import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand } from '@/constants/theme';
import { HText } from '@/features/dashboard/home-ui';
import { useLanguage } from '@/i18n/use-language';

import { extractVin } from './plate';

/**
 * Lecture du code-barres du VIN avec l'appareil photo (types de codes présents sur les pare-brise et cartes : code 39, code 128,
 * data matrix, PDF417, QR). Un VIN n'est accepté que s'il a 17 caractères valides ; sinon on laisse chercher (rien n'est inventé).
 */
export function VinScanner({ visible, onClose, onScanned }: { visible: boolean; onClose: () => void; onScanned: (vin: string) => void }) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [unreadable, setUnreadable] = useState(false);
  const [done, setDone] = useState(false);

  function handle(data: string) {
    if (done) return;
    const vin = extractVin(data);
    if (!vin) {
      setUnreadable(true);
      return;
    }
    setDone(true);
    onScanned(vin);
    onClose();
  }

  const denied = permission && !permission.granted && !permission.canAskAgain;
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} onShow={() => { setDone(false); setUnreadable(false); if (permission && !permission.granted && permission.canAskAgain) void requestPermission(); }}>
      <View style={{ flex: 1, backgroundColor: Brand.graphite }}>
        {permission?.granted ? (
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['code39', 'code128', 'datamatrix', 'pdf417', 'qr'] }}
            onBarcodeScanned={({ data }) => handle(data)}
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
            <HText color={Brand.textOnDark} style={{ textAlign: 'center' }}>
              {denied ? t('vehicleAdd.verify.vinScanDenied') : t('vehicleAdd.verify.vinScanHint')}
            </HText>
          </View>
        )}
        <View pointerEvents="none" style={{ position: 'absolute', start: 24, end: 24, top: '38%', height: 110, borderRadius: 18, borderWidth: 3, borderColor: Brand.white }} />
        <View style={{ position: 'absolute', start: 20, end: 20, bottom: insets.bottom + 28, alignItems: 'center', gap: 12 }}>
          <HText weight="semibold" color={Brand.white} style={{ textAlign: 'center' }}>
            {unreadable ? t('vehicleAdd.verify.vinScanNone') : t('vehicleAdd.verify.vinScanHint')}
          </HText>
        </View>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('vehicleAdd.verify.close')}
          style={{ position: 'absolute', start: 20, top: insets.top + 8, width: 44, height: 44, borderRadius: 22, backgroundColor: Brand.surfaceOnDark, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="close" size={20} color={Brand.white} />
        </Pressable>
      </View>
    </Modal>
  );
}

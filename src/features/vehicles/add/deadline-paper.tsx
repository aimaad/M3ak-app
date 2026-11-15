import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { CameraCapture, checkPhoto } from '@/components/form';
import { Brand, Palette } from '@/constants/theme';
import { HText } from '@/features/dashboard/home-ui';
import { useLanguage } from '@/i18n/use-language';

/**
 * Photo FACULTATIVE du papier d'une échéance (assurance, visite technique) à la création du véhicule : un petit bouton appareil photo à côté
 * de la date. Une fois le papier pris, une coche remplace l'icône (on peut le retirer). La caméra propose aussi la galerie.
 */
export function DeadlinePaperButton({ label, uri, onPick, onRemove }: { label: string; uri: string | null; onPick: (uri: string) => void; onRemove: () => void }) {
  const { t } = useLanguage();
  const [camera, setCamera] = useState(false);
  const [problem, setProblem] = useState<'too_small' | 'unreadable' | null>(null);

  async function onCaptured(captured: string) {
    setCamera(false);
    const check = await checkPhoto(captured);
    if (!check.ok) {
      setProblem(check.reason);
      return;
    }
    setProblem(null);
    onPick(captured);
  }

  return (
    <View style={{ gap: 4 }}>
      <Pressable
        onPress={() => (uri ? onRemove() : setCamera(true))}
        accessibilityRole="button"
        accessibilityLabel={uri ? `${t('vehicleAdd.finalize.paper.remove')} : ${label}` : `${t('vehicleAdd.finalize.paper.add')} : ${label}`}
        hitSlop={6}
        style={{ width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: uri ? Palette.success : Palette.surface, borderWidth: uri ? 0 : 1, borderColor: Palette.border }}
      >
        <Ionicons name={uri ? 'checkmark' : 'camera-outline'} size={20} color={uri ? Brand.white : Palette.textPrimary} />
      </Pressable>
      {problem ? (
        <HText size={11} weight="semibold" color={Palette.error} accessibilityRole="alert">
          {t(problem === 'too_small' ? 'vehicleForm.edit.scan.tooSmall' : 'vehicleForm.edit.scan.unreadable')}
        </HText>
      ) : null}
      <CameraCapture visible={camera} onClose={() => setCamera(false)} onCapture={(captured) => void onCaptured(captured)} hint={t('vehicleDetail.compliance.photoHint')} />
    </View>
  );
}

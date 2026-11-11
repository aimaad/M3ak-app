import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Modal, Pressable, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { Brand, Palette } from '@/constants/theme';
import { HText } from '@/features/dashboard/home-ui';
import { useLanguage } from '@/i18n/use-language';

import { withAlpha } from '../fleet-style';
import type { Face } from './scan-session';

const CORNER = 38;
const corner = (style: object) => <View pointerEvents="none" style={[{ position: 'absolute', width: CORNER, height: CORNER, borderColor: Brand.white }, style]} />;

/** Cadre au format carte (≈ 85,6 × 54), 4 coins blancs arrondis et ligne de lecture orange qui balaie le cadre (simple guidage : aucune détection). */
export function ScanFrame({ width, height }: { width: number; height: number }) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(progress);
      progress.value = 0.5;
      return undefined;
    }
    progress.value = withRepeat(withSequence(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.quad) })), -1);
    return () => cancelAnimation(progress);
  }, [progress, reduceMotion]);
  const lineStyle = useAnimatedStyle(() => ({ transform: [{ translateY: 12 + progress.value * Math.max(height - 28, 0) }] }));
  return (
    <View style={{ width, height }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {corner({ start: 0, top: 0, borderStartWidth: 4, borderTopWidth: 4, borderTopStartRadius: 16 })}
      {corner({ end: 0, top: 0, borderEndWidth: 4, borderTopWidth: 4, borderTopEndRadius: 16 })}
      {corner({ start: 0, bottom: 0, borderStartWidth: 4, borderBottomWidth: 4, borderBottomStartRadius: 16 })}
      {corner({ end: 0, bottom: 0, borderEndWidth: 4, borderBottomWidth: 4, borderBottomEndRadius: 16 })}
      <Animated.View style={[{ position: 'absolute', start: 16, end: 16, top: 0, height: 2, borderRadius: 1, backgroundColor: Brand.orangeLight, shadowColor: Brand.orangeLight, shadowOpacity: 1, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } }, lineStyle]} />
    </View>
  );
}

/** Conseils fixes (vrais : rien n'est mesuré), sans point de couleur. */
export function TipPills({ tips }: { tips: string[] }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
      {tips.map((tip) => (
        <View key={tip} style={{ backgroundColor: withAlpha(Brand.graphite, 0.8), borderWidth: 1, borderColor: Brand.strokeOnDark, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 }}>
          <HText weight="semibold" size={11} color={Brand.textOnDark}>
            {tip}
          </HText>
        </View>
      ))}
    </View>
  );
}

/** Vignette R / V : bordure verte une fois la face prise, pointillés sinon. Un tap permet de reprendre cette face. */
export function FaceThumb({ face, taken, current, onPress, label }: { face: Face; taken: boolean; current: boolean; onPress: () => void; label: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: current }}
      hitSlop={4}
      style={{ width: 42, height: 54, borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 3, backgroundColor: taken ? Brand.surfaceOnDark : 'transparent', borderWidth: taken ? 2 : 1.5, borderStyle: taken ? 'solid' : 'dashed', borderColor: taken ? Brand.successOnDark : current ? Brand.orange : Brand.strokeOnDark }}
    >
      <View style={{ width: 28, height: 18, borderRadius: 3, backgroundColor: taken ? Brand.textOnDark : 'transparent' }} />
      <HText weight="bold" size={9} color={taken ? Brand.white : Brand.mutedOnDark} style={{ lineHeight: 12 }}>
        {face === 'recto' ? 'R' : 'V'}
      </HText>
    </Pressable>
  );
}

/** Interrupteur (orange = activé) pour « Garder la photo dans le dossier ». */
export function KeepSwitch({ value, onChange, label }: { value: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      hitSlop={8}
      style={{ width: 50, height: 30, borderRadius: 15, padding: 3, flexDirection: 'row', justifyContent: value ? 'flex-end' : 'flex-start', backgroundColor: value ? Brand.orange : Brand.strokeOnDark }}
    >
      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: Brand.white }} />
    </Pressable>
  );
}

/** « En savoir plus » : le texte légal actuel, entier et inchangé, dans une feuille. */
export function LegalSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useLanguage();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: withAlpha(Brand.graphite, 0.6) }} onPress={onClose} accessibilityLabel={t('vehicleAdd.scan.close')} />
      <View style={{ backgroundColor: Palette.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 32, gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <HText font="display" weight="bold" size={18} accessibilityRole="header">
            {t('vehicleAdd.scan.legalTitle')}
          </HText>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('vehicleAdd.scan.close')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={20} color={Palette.textPrimary} />
          </Pressable>
        </View>
        <HText size={14} color={Palette.textSecondary} style={{ lineHeight: 21 }}>
          {t('ocr.privacyCloud')}
        </HText>
        <HText size={14} color={Palette.textSecondary} style={{ lineHeight: 21 }}>
          {t('ocr.keepPhoto.on')}
        </HText>
      </View>
    </Modal>
  );
}

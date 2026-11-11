import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Image, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { Brand } from '@/constants/theme';
import { isRTL } from '@/i18n';
import { useLanguage } from '@/i18n/use-language';

import { withAlpha } from '../fleet-style';
import { DEFAULT_VEHICLE_IMAGE } from '../vehicle-image';

/** Retour : revient à l'écran précédent, ou à Ma Flotte si on est arrivé directement ici. */
export function goBack(fallback: string = '/flotte') {
  if (router.canGoBack()) router.back();
  else router.replace(fallback as never);
}

/** Cercle de 44 px (retour, fermer, lampe…) sur fond graphite. */
export function RoundButton({ icon, label, onPress, active = false, color = Brand.white, solid = false }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; active?: boolean; color?: string; solid?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: Brand.strokeOnDark, backgroundColor: active ? Brand.warningOnDark : withAlpha(Brand.surfaceOnDark, solid ? 1 : 0.7), alignItems: 'center', justifyContent: 'center' }}
    >
      <Ionicons name={icon} size={18} color={active ? Brand.graphite : color} />
    </Pressable>
  );
}

export function BackButton({ onPress = () => goBack() }: { onPress?: () => void }) {
  const { t, language } = useLanguage();
  return <RoundButton icon={isRTL(language) ? 'chevron-forward' : 'chevron-back'} label={t('vehicleAdd.back')} onPress={onPress} solid />;
}

/**
 * En-tête graphite des écrans d'ajout : coins bas arrondis, photo de voiture en fond (`photo`) ou halo orange (`glow`), contenu en enfant.
 * Le haut tient compte de la zone sûre du téléphone.
 */
export function AddHeader({ children, radius = 34, photo = false, glow = false, gap = 18 }: { children: ReactNode; radius?: number; photo?: boolean; glow?: boolean; gap?: number }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: Brand.graphite, borderBottomLeftRadius: radius, borderBottomRightRadius: radius, overflow: 'hidden', paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 24, gap }}>
      {photo ? (
        <View pointerEvents="none" style={{ position: 'absolute', end: -90, top: 40, width: 330, height: 206 }} accessibilityElementsHidden importantForAccessibility="no">
          <Image source={DEFAULT_VEHICLE_IMAGE} style={{ width: '100%', height: '100%', opacity: 0.55 }} resizeMode="cover" />
        </View>
      ) : null}
      {glow ? (
        <View pointerEvents="none" style={{ position: 'absolute', start: 0, end: 0, top: 120, height: 300 }}>
          <Svg width="100%" height="100%">
            <Defs>
              <RadialGradient id="addGlow" cx="50%" cy="50%" rx="50%" ry="50%">
                <Stop offset="0" stopColor={Brand.orange} stopOpacity={0.22} />
                <Stop offset="1" stopColor={Brand.orange} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#addGlow)" />
          </Svg>
        </View>
      ) : null}
      {children}
    </View>
  );
}

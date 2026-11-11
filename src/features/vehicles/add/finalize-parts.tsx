import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Image, Pressable, TextInput, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { Brand, HomeFonts, Palette } from '@/constants/theme';
import { HText } from '@/features/dashboard/home-ui';
import { useLanguage } from '@/i18n/use-language';

import { withAlpha } from '../fleet-style';
import { formatThousands } from './finalize';

const RING = 138.2;

/** Anneau d'avancement des infos essentielles (« 1/3 »), lu « 1 sur 3 informations essentielles remplies ». */
export function ProgressRing({ done, total }: { done: number; total: number }) {
  const { t } = useLanguage();
  const dash = total > 0 ? (RING * done) / total : 0;
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={t('vehicleAdd.finalize.ringA11y', { done, total })} accessibilityValue={{ min: 0, max: total, now: done }} style={{ width: 52, height: 52 }}>
      <Svg width={52} height={52} viewBox="0 0 52 52" style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={26} cy={26} r={22} fill={withAlpha(Brand.graphite, 0.8)} stroke={Brand.strokeOnDark} strokeWidth={5} />
        <Circle cx={26} cy={26} r={22} fill="none" stroke={Brand.orange} strokeWidth={5} strokeLinecap="round" strokeDasharray={`${dash} ${RING}`} />
      </Svg>
      <View style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, alignItems: 'center', justifyContent: 'center' }}>
        <HText weight="bold" size={12} color={Brand.white}>{`${done}/${total}`}</HText>
      </View>
    </View>
  );
}

/** Carte numérotée de « L'essentiel » : mise en avant (bordure orange) quand c'est la première info à remplir ; pastille verte une fois remplie. */
export function EssentialCard({ number, title, note, done, highlighted, children }: { number: number; title: string; note?: string; done: boolean; highlighted: boolean; children: ReactNode }) {
  return (
    <View style={{ backgroundColor: Palette.card, borderRadius: 24, padding: 16, gap: highlighted ? 14 : 12, borderWidth: highlighted ? 1.5 : 1, borderColor: highlighted ? Brand.orange : Palette.border, shadowColor: highlighted ? Brand.orange : Palette.shadow, shadowOpacity: highlighted ? 0.15 : 0.05, shadowRadius: highlighted ? 14 : 12, shadowOffset: { width: 0, height: highlighted ? 10 : 8 } }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 }}>
          <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: done ? Palette.success : highlighted ? Brand.orange : Brand.graphite, alignItems: 'center', justifyContent: 'center' }}>
            <HText weight="bold" size={12} color={Brand.white}>
              {String(number)}
            </HText>
          </View>
          <HText weight="semibold" size={15} style={{ flexShrink: 1 }}>
            {title}
          </HText>
        </View>
        {note ? (
          <HText size={11} color={Palette.textSecondary} style={{ flexShrink: 1, textAlign: 'right' }}>
            {note}
          </HText>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const stepButton = { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.card, alignItems: 'center' as const, justifyContent: 'center' as const };

/** Prix : valeur très grande, − et + de 48 px (pas de 50), un tap sur le chiffre ouvre le clavier numérique. */
export function PriceStepper({ value, onChange, onMinus, onPlus }: { value: string; onChange: (digits: string) => void; onMinus: () => void; onPlus: () => void }) {
  const { t } = useLanguage();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <Pressable onPress={onMinus} accessibilityRole="button" accessibilityLabel={t('vehicleAdd.finalize.minus')} style={stepButton}>
        <Ionicons name="remove" size={22} color={Palette.textPrimary} />
      </Pressable>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 6 }}>
        <TextInput
          value={value}
          onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          maxLength={6}
          placeholder="—"
          placeholderTextColor={Palette.textMuted}
          accessibilityLabel={t('vehicleAdd.finalize.priceA11y')}
          style={{ minWidth: 70, maxWidth: 160, fontFamily: HomeFonts.display.bold, fontSize: 48, letterSpacing: -1, color: Brand.graphite, textAlign: 'center', padding: 0, height: 62 }}
        />
        <HText weight="semibold" size={14} color={Palette.textSecondary}>
          {t('vehicleAdd.finalize.mad')}
        </HText>
      </View>
      <Pressable onPress={onPlus} accessibilityRole="button" accessibilityLabel={t('vehicleAdd.finalize.plus')} style={stepButton}>
        <Ionicons name="add" size={22} color={Palette.textPrimary} />
      </Pressable>
    </View>
  );
}

/** Kilométrage : grand champ numérique (24 px), « km » en suffixe, séparateur de milliers. */
export function KmField({ value, onChange, highlighted }: { value: string; onChange: (digits: string) => void; highlighted: boolean }) {
  const { t } = useLanguage();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', height: 60, borderRadius: 16, borderWidth: 1.5, borderColor: highlighted ? Brand.orange : Palette.border, backgroundColor: Palette.card, paddingHorizontal: 16 }}>
      <TextInput
        value={formatThousands(value)}
        onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, 7))}
        keyboardType="number-pad"
        placeholder={t('vehicleAdd.finalize.kmPlaceholder')}
        placeholderTextColor={Palette.textMuted}
        accessibilityLabel={t('vehicleAdd.finalize.km')}
        style={{ flex: 1, minWidth: 0, fontFamily: HomeFonts.display.bold, fontSize: 24, color: Brand.graphite, padding: 0 }}
      />
      <HText weight="semibold" size={14} color={Palette.textSecondary}>
        {t('vehicleAdd.finalize.kmUnit')}
      </HText>
    </View>
  );
}

/** Photo de face : grande zone sombre avec la silhouette d'une voiture, bouton orange, galerie et autres photos. */
export function PhotoZone({ uri, extraCount, onTake, onGallery, onMore }: { uri: string | null; extraCount: number; onTake: () => void; onGallery: () => void; onMore: () => void }) {
  const { t } = useLanguage();
  const outline = withAlpha(Brand.textOnDark, 0.35);
  return (
    <View style={{ gap: 12 }}>
      <Pressable onPress={onTake} accessibilityRole="button" accessibilityLabel={uri ? t('vehicleAdd.finalize.changePhoto') : t('vehicleAdd.finalize.takePhoto')} style={{ height: 170, borderRadius: 18, borderWidth: 1.5, borderStyle: 'dashed', borderColor: Palette.border, backgroundColor: Brand.graphite, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
        {uri ? (
          <>
            <Image source={{ uri }} accessibilityLabel={t('vehicleAdd.finalize.photoA11y')} style={{ position: 'absolute', width: '100%', height: '100%' }} resizeMode="cover" />
            <View style={{ position: 'absolute', end: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: withAlpha(Brand.graphite, 0.85), borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 }}>
              <Ionicons name="camera-outline" size={14} color={Brand.white} />
              <HText weight="semibold" size={12} color={Brand.white}>
                {t('vehicleAdd.finalize.changePhoto')}
              </HText>
            </View>
          </>
        ) : (
          <>
            <Svg width={230} height={110} viewBox="0 0 230 110" fill="none" style={{ position: 'absolute' }}>
              <Path d="M20 80V58l22-26h146l22 26v22M20 80h190M40 58h150M60 32l-6 26M170 32l6 26" stroke={outline} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              <Rect x={34} y={66} width={34} height={9} rx={4} stroke={outline} strokeWidth={2} />
              <Rect x={162} y={66} width={34} height={9} rx={4} stroke={outline} strokeWidth={2} />
            </Svg>
            <View style={{ alignItems: 'center', gap: 8 }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: Brand.orange, alignItems: 'center', justifyContent: 'center', shadowColor: Brand.orange, shadowOpacity: 0.45, shadowRadius: 10, shadowOffset: { width: 0, height: 8 } }}>
                <Ionicons name="camera-outline" size={24} color={Brand.white} />
              </View>
              <HText weight="semibold" size={13} color={Brand.white}>
                {t('vehicleAdd.finalize.takePhoto')}
              </HText>
            </View>
          </>
        )}
      </Pressable>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[
          { label: t('vehicleAdd.finalize.fromGallery'), onPress: onGallery },
          { label: extraCount > 0 ? t('vehicleAdd.finalize.morePhotosCount', { count: extraCount }) : t('vehicleAdd.finalize.morePhotos'), onPress: onMore },
        ].map((button) => (
          <Pressable key={button.label} onPress={button.onPress} accessibilityRole="button" style={{ flex: 1, minHeight: 44, borderRadius: 22, borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.card, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }}>
            <HText weight="semibold" size={13} numberOfLines={1}>
              {button.label}
            </HText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** Pastilles de choix (catégorie, carburant, filiale) : une seule active, 44 px minimum. */
export function ChoiceChips<T extends string>({ options, selected, getLabel, onSelect }: { options: readonly T[]; selected: T | null; getLabel: (option: T) => string; onSelect: (option: T) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((option) => {
        const on = option === selected;
        return (
          <Pressable key={option} onPress={() => onSelect(option)} accessibilityRole="button" accessibilityLabel={getLabel(option)} accessibilityState={{ selected: on }} style={{ minHeight: 42, borderRadius: 21, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? Brand.graphite : Palette.card, borderWidth: 1, borderColor: on ? Brand.graphite : Palette.border }}>
            <HText weight="semibold" size={13} color={on ? Brand.white : Palette.textPrimary}>
              {getLabel(option)}
            </HText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Interrupteur vert (« Louable tout de suite »). */
export function GreenSwitch({ value, onChange, label }: { value: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <Pressable onPress={() => onChange(!value)} accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: value }} hitSlop={8} style={{ width: 50, height: 30, borderRadius: 15, padding: 3, flexDirection: 'row', justifyContent: value ? 'flex-end' : 'flex-start', backgroundColor: value ? Palette.success : Palette.textMuted }}>
      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: Brand.white }} />
    </Pressable>
  );
}

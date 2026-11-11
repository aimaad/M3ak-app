import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { Brand, Palette } from '@/constants/theme';
import { ArrowIcon, HText } from '@/features/dashboard/home-ui';
import { useLanguage } from '@/i18n/use-language';

import { plateText } from '../fleet-card';
import { VehicleImage, vehicleName } from '../vehicle-image';
import { withAlpha } from '../fleet-style';
import type { Vehicle } from '../types';

export type FoundInfo = {
  vehicle: Vehicle;
  archived: boolean;
  /** Pastille de statut sur la photo (même libellé que dans Ma Flotte) ; absente pour un véhicule archivé. */
  status: { label: string; tone: 'free' | 'rented' | 'inspect' | 'unavailable' | 'late' } | null;
  /** Ligne de contexte (même texte que dans Ma Flotte, retards compris) ; null pour un véhicule archivé. */
  context: { text: string; late: boolean } | null;
  since: string;
  rentals: number;
  occupancy: number;
};

const TONE: Record<NonNullable<FoundInfo['status']>['tone'], { background: string; text: string }> = {
  free: { background: Palette.success, text: Brand.white },
  rented: { background: Brand.textOnDark, text: Brand.graphite },
  inspect: { background: Brand.warningOnDark, text: Brand.graphite },
  unavailable: { background: Palette.textMuted, text: Brand.white },
  late: { background: Palette.error, text: Brand.white },
};

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, minWidth: 0, backgroundColor: Palette.surface, borderRadius: 14, padding: 10, gap: 2 }}>
      <HText font="display" weight="bold" size={15} numberOfLines={1}>
        {value}
      </HText>
      <HText size={10} color={Palette.textSecondary} numberOfLines={2}>
        {label}
      </HText>
    </View>
  );
}

const CARD = { backgroundColor: Palette.card, borderWidth: 1, borderColor: Palette.border, borderRadius: 24, shadowColor: Palette.shadow, shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 10 }, elevation: 2 };

/** Résultat « trouvé » : le véhicule est déjà dans la flotte (archivé ou non). */
export function FoundCard({ info, onOpen }: { info: FoundInfo; onOpen: () => void }) {
  const { t } = useLanguage();
  const { vehicle } = info;
  const tone = info.status ? TONE[info.status.tone] : null;
  return (
    <View style={[CARD, { overflow: 'hidden' }]} accessibilityLiveRegion="polite">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Brand.graphite }}>
        <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: Brand.warningOnDark, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="alert" size={14} color={Brand.graphite} />
        </View>
        <HText weight="semibold" size={13} color={Brand.white}>
          {t(info.archived ? 'vehicleAdd.verify.foundArchived' : 'vehicleAdd.verify.found')}
        </HText>
      </View>
      <View style={{ padding: 14, gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <VehicleImage vehicle={vehicle} width={110} height={80} radius={16}>
            {info.status && tone ? (
              <View style={{ position: 'absolute', start: 6, bottom: 6, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 7, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: withAlpha(tone.background, 0.95) }}>
                <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: tone.text }} />
                <HText weight="bold" size={9} color={tone.text} style={{ lineHeight: 12 }}>
                  {info.status.label}
                </HText>
              </View>
            ) : info.archived ? (
              <View style={{ position: 'absolute', start: 6, bottom: 6, borderRadius: 7, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: Palette.textMuted }}>
                <HText weight="bold" size={9} color={Brand.white} style={{ lineHeight: 12 }}>
                  {t('vehicleAdd.verify.archived')}
                </HText>
              </View>
            ) : null}
          </VehicleImage>
          <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
            <HText font="display" weight="bold" size={16} numberOfLines={1}>
              {vehicleName(vehicle)}
            </HText>
            <View style={{ alignSelf: 'flex-start', borderWidth: 1.5, borderColor: Brand.graphite, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 1, direction: 'ltr' }}>
              <HText weight="bold" size={11} style={{ writingDirection: 'ltr' }}>
                {plateText(vehicle.immatriculation)}
              </HText>
            </View>
            {info.context ? (
              <HText size={12} color={info.context.late ? Palette.error : Palette.textSecondary} numberOfLines={2}>
                {info.context.text}
              </HText>
            ) : null}
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Stat value={info.since} label={t('vehicleAdd.verify.since')} />
          <Stat value={String(info.rentals)} label={t('vehicleAdd.verify.rentals')} />
          <Stat value={`${info.occupancy} %`} label={t('vehicleAdd.verify.occupancy')} />
        </View>
        <Pressable onPress={onOpen} accessibilityRole="button" style={{ height: 48, borderRadius: 24, backgroundColor: Brand.graphite, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <HText weight="semibold" size={14} color={Brand.white}>
            {t('vehicleAdd.verify.openFile')}
          </HText>
          <ArrowIcon color={Brand.white} size={15} />
        </Pressable>
      </View>
    </View>
  );
}

/** Résultat « non trouvé » : coche verte, et « L'ajouter à ma flotte » qui ouvre le choix de la méthode avec la saisie gardée. */
export function NotFoundCard({ valueText, vin, onAdd }: { valueText: string; vin: boolean; onAdd: () => void }) {
  const { t } = useLanguage();
  return (
    <View style={[CARD, { padding: 18, paddingTop: 22, alignItems: 'center', gap: 12 }]} accessibilityLiveRegion="polite">
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: Palette.successSoft, alignItems: 'center', justifyContent: 'center', borderWidth: 8, borderColor: withAlpha(Palette.success, 0.08) }}>
        <Ionicons name="checkmark" size={28} color={Palette.success} />
      </View>
      <HText font="display" weight="bold" size={18}>
        {t('vehicleAdd.verify.notFound')}
      </HText>
      <HText size={13} color={Palette.textSecondary} style={{ textAlign: 'center', lineHeight: 19 }}>
        {t(vin ? 'vehicleAdd.verify.notFoundVin' : 'vehicleAdd.verify.notFoundPlate', { value: valueText })}
      </HText>
      <Pressable onPress={onAdd} accessibilityRole="button" style={{ minHeight: 44, borderRadius: 22, borderWidth: 1, borderColor: Palette.border, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <HText weight="semibold" size={13}>
          {t('vehicleAdd.verify.addIt')}
        </HText>
        <ArrowIcon color={Brand.graphite} size={14} />
      </Pressable>
    </View>
  );
}

import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { Brand, Palette } from '@/constants/theme';
import { ArrowIcon, HText, MicroLabel } from '@/features/dashboard/home-ui';
import { useLanguage } from '@/i18n/use-language';

import { occupancyTone, plateText, type FleetAction, type FleetContext, type OccupancyTone } from './fleet-card';
import { cardSentence, contextTexts, lateBadgeText, weekSummaryText } from './fleet-card-text';
import type { FleetItem, FleetSection } from './fleet-model';
import { WEEK_COLOR, withAlpha } from './fleet-style';
import { VehicleImage, vehicleName } from './vehicle-image';

const BADGE: Record<FleetSection | 'late', { background: string; text: string; dot: string }> = {
  late: { background: Palette.error, text: Brand.white, dot: Brand.white },
  free: { background: withAlpha(Palette.success, 0.92), text: Brand.white, dot: Brand.white },
  rented: { background: withAlpha(Brand.textOnDark, 0.95), text: Brand.graphite, dot: Brand.graphite },
  inspect: { background: withAlpha(Brand.warningOnDark, 0.95), text: Brand.graphite, dot: Brand.graphite },
  maintenance: { background: withAlpha(Brand.warningOnDark, 0.95), text: Brand.graphite, dot: Brand.graphite },
  unavailable: { background: Palette.textMuted, text: Brand.white, dot: Brand.white },
};

const OCCUPANCY_COLOR: Record<OccupancyTone, string> = { good: Palette.success, neutral: Brand.graphite, low: Brand.orange };
const PHOTO_WIDTH = 128;
const CAMERA = 26;

/**
 * Carte véhicule de Ma Flotte : photo (ou image par défaut) avec badge de statut, nom, plaque marocaine, kilométrage et prix
 * (propriétaire seulement), ligne de contexte, frise des 7 prochains jours, occupation 30 j et bouton d'action.
 * Zones tactiles SÉPARÉES : le corps de la carte ouvre la fiche, le bouton d'action et le rond appareil photo sont des frères,
 * jamais un pressable dans un pressable.
 */
export function FleetVehicleCard({
  item,
  context,
  action,
  showPrice,
  canAddPhoto,
  onOpen,
  onAction,
  onAddPhoto,
  now,
}: {
  item: FleetItem;
  context: FleetContext;
  action: FleetAction | null;
  showPrice: boolean;
  canAddPhoto: boolean;
  onOpen: () => void;
  onAction: (action: FleetAction) => void;
  onAddPhoto: () => void;
  /** « Maintenant » de l'écran (un seul pour toute la liste) : dates et retards sont calculés avec lui. */
  now: Date;
}) {
  const { t, language } = useLanguage();
  const { vehicle } = item;
  const name = vehicleName(vehicle);
  const late = item.late;
  const badgeKey = late ? 'late' : item.section;
  const badge = BADGE[badgeKey];
  const texts = contextTexts(context, language, t, now);
  const weekSummary = weekSummaryText(item.week, language, t, now);
  const noPhoto = vehicle.photos.length === 0 && canAddPhoto;
  const actionLabel = action ? t(`flotte.card.action.${action.kind}`) : '';
  const plate = plateText(vehicle.immatriculation);

  return (
    <View style={{ backgroundColor: Palette.card, borderWidth: 1, borderColor: Palette.border, borderRadius: 24, padding: 10, gap: 12, shadowColor: Palette.shadow, shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 1 }}>
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={cardSentence(item, context, language, t, now)} style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 12 }} importantForAccessibility="no-hide-descendants">
          <VehicleImage vehicle={vehicle} width={PHOTO_WIDTH} height={96} radius={18}>
            <View style={{ position: 'absolute', start: 6, bottom: 6, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, paddingVertical: 3, paddingHorizontal: 7, backgroundColor: badge.background }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: badge.dot }} />
              <HText weight="bold" size={10} color={badge.text} style={{ lineHeight: 13 }}>
                {t(`flotte.card.status.${badgeKey}`)}
              </HText>
            </View>
          </VehicleImage>
          <View style={{ flex: 1, minWidth: 0, justifyContent: 'space-between', paddingVertical: 2, paddingEnd: 4 }}>
            <View style={{ gap: 7 }}>
              <HText font="display" weight="bold" size={16} numberOfLines={1}>
                {name}
              </HText>
              {/* Plaque marocaine : numéro | lettre | région, toujours dans cet ordre, même en arabe. */}
              <View style={{ alignSelf: 'flex-start', borderWidth: 1.5, borderColor: Brand.graphite, borderRadius: 6, paddingVertical: 2, paddingHorizontal: 7, backgroundColor: Palette.card, direction: 'ltr' }}>
                <HText weight="bold" size={11} track={0.04} style={{ writingDirection: 'ltr', lineHeight: 14 }}>
                  {plate}
                </HText>
              </View>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <HText size={12} color={Palette.textSecondary}>
                {`${vehicle.kilometrage.toLocaleString('fr-FR')} ${t('flotte.km')}`}
              </HText>
              {showPrice ? (
                <HText font="display" weight="bold" size={16} numberOfLines={1}>
                  {vehicle.prixJour.toLocaleString('fr-FR')}
                  <HText size={11} color={Palette.textSecondary}>{` ${t('flotte.card.perDay')}`}</HText>
                </HText>
              ) : null}
            </View>
          </View>
        </View>

        <View style={{ gap: 8, paddingHorizontal: 4 }} importantForAccessibility="no-hide-descendants">
          {/* Les deux blocs ne se coupent jamais : si la place manque, « 7 PROCHAINS JOURS » passe à la ligne en entier. */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', columnGap: 8, rowGap: 4 }}>
            <View style={{ flexShrink: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <HText weight="semibold" size={12} numberOfLines={1} color={late ? Palette.error : Palette.textPrimary} style={{ flexShrink: 1 }}>
                {texts.display}
              </HText>
              {late ? (
                <View style={{ flexShrink: 0, backgroundColor: Palette.error, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 }}>
                  <HText weight="bold" size={11} color={Brand.white} numberOfLines={1} style={{ lineHeight: 15 }}>
                    {lateBadgeText(late, t)}
                  </HText>
                </View>
              ) : null}
            </View>
            <MicroLabel size={10} track={0.12} color={Palette.textSecondary} numberOfLines={1} style={{ flexShrink: 0 }}>
              {t('flotte.card.sevenDays').replace(/ /g, '\u00a0')}
            </MicroLabel>
          </View>
          {/* Frise des 7 prochains jours : aujourd'hui en premier (à droite en arabe), cerclé d'orange. */}
          <View accessible accessibilityLabel={t('flotte.card.weekA11y', { summary: weekSummary })} style={{ flexDirection: 'row', gap: 4 }}>
            {item.week.map((day, index) => (
              <View key={day.key} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                <View style={{ height: 15, alignSelf: 'stretch', justifyContent: 'center' }}>
                  {index === 0 ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, start: -3.5, end: -3.5, borderRadius: 7.5, borderWidth: 1.5, borderColor: Brand.orange }} /> : null}
                  <View style={{ height: 8, borderRadius: 4, backgroundColor: WEEK_COLOR[day.kind] }} />
                </View>
                <HText weight={index === 0 ? 'bold' : 'medium'} size={10} color={index === 0 ? Brand.orange : Palette.textSecondary} style={{ lineHeight: 13 }}>
                  {String(day.date.getDate())}
                </HText>
              </View>
            ))}
          </View>
        </View>
      </Pressable>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 10, paddingHorizontal: 4, paddingBottom: 2, borderTopWidth: 1, borderTopColor: Brand.gaugeTrack }}>
        <Pressable onPress={onOpen} accessible={false} importantForAccessibility="no" style={{ flex: 1, minWidth: 0, gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <HText size={11} color={Palette.textSecondary}>
              {t('flotte.card.occupancy')}
            </HText>
            <HText weight="bold" size={11}>{`${item.occupancy} %`}</HText>
          </View>
          <View style={{ height: 5, borderRadius: 3, backgroundColor: Brand.gaugeTrack, overflow: 'hidden', flexDirection: 'row' }}>
            <View style={{ width: `${Math.max(item.occupancy, 2)}%`, borderRadius: 3, backgroundColor: OCCUPANCY_COLOR[occupancyTone(item.occupancy)] }} />
          </View>
        </Pressable>
        {action ? (
          <Pressable
            onPress={() => onAction(action)}
            accessibilityRole="button"
            accessibilityLabel={t('flotte.card.actionA11y', { action: actionLabel, name })}
            style={[
              { height: 44, borderRadius: 22, paddingStart: 18, paddingEnd: 14, flexDirection: 'row', alignItems: 'center', gap: 4 },
              action.kind === 'rent'
                ? { backgroundColor: Brand.orange, shadowColor: Brand.orange, shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 6 } }
                : action.kind === 'call'
                  ? { backgroundColor: Palette.error, shadowColor: Palette.error, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 6 } }
                  : { backgroundColor: Brand.graphite },
            ]}
          >
            <HText weight="semibold" size={13} color={Brand.white}>
              {actionLabel}
            </HText>
            <ArrowIcon color={Brand.white} size={14} />
          </Pressable>
        ) : null}
      </View>

      {/* Sans photo : petit appareil photo pour en ajouter une (frère du corps de la carte, pas enfant). */}
      {noPhoto ? (
        <Pressable
          onPress={onAddPhoto}
          hitSlop={9}
          accessibilityRole="button"
          accessibilityLabel={t('flotte.card.addPhoto', { name })}
          style={{ position: 'absolute', top: 10 + 6, start: 10 + PHOTO_WIDTH - 6 - CAMERA, width: CAMERA, height: CAMERA, borderRadius: CAMERA / 2, backgroundColor: withAlpha(Brand.graphite, 0.8), alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="camera-outline" size={13} color={Brand.white} />
        </Pressable>
      ) : null}
    </View>
  );
}

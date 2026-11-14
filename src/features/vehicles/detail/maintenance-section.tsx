import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';

import { DUE_TYPE_IMAGE } from '@/constants/due-icons';
import { Brand, Palette } from '@/constants/theme';
import { formatAmount, HText } from '@/features/dashboard/home-ui';
import { computeMaintenanceUrgency, type MaintenanceUrgency } from '@/features/maintenance/urgency';
import type { MaintenanceItem } from '@/features/maintenance/types';
import { useLanguage } from '@/i18n/use-language';

import type { Vehicle } from '../types';
import { QuickDoneCard } from './quick-done-card';

const CARD = { backgroundColor: Brand.white, borderWidth: 1, borderColor: Palette.border, borderRadius: 24, padding: 16, gap: 4 } as const;
const URGENCY_COLOR: Record<MaintenanceUrgency, { background: string; text: string }> = {
  a_venir: { background: Palette.surfaceAlt, text: Palette.textSecondary },
  due: { background: Palette.warningSoft, text: Palette.warning },
  en_retard: { background: Palette.errorSoft, text: Palette.error },
};
const RANK: Record<MaintenanceUrgency, number> = { en_retard: 0, due: 1, a_venir: 2 };
const dayText = (iso: string, language: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString(language === 'ar' ? 'ar-MA' : 'fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Section « Entretien » de la fiche : c'est ICI qu'on fait les entretiens (« ✓ Fait » en un geste), pas dans « Échéances » qui sert à les
 * créer. À faire (les plus urgents d'abord) puis historique des entretiens effectués ; les coûts sont réservés au propriétaire et au responsable.
 */
export function MaintenanceSection({ vehicle, items, now, showCost }: { vehicle: Vehicle; items: MaintenanceItem[]; now: Date; showCost: boolean }) {
  const { t, language } = useLanguage();
  const [openId, setOpenId] = useState<string | null>(null);
  const todo = items
    .filter((item) => item.statut !== 'effectuee')
    .map((item) => ({ item, urgency: computeMaintenanceUrgency(item, vehicle.kilometrage, now) }))
    .sort((a, b) => (a.item.statut === 'en_cours' ? -1 : 0) - (b.item.statut === 'en_cours' ? -1 : 0) || RANK[a.urgency] - RANK[b.urgency] || (a.item.echeanceDate ?? '9999').localeCompare(b.item.echeanceDate ?? '9999'));
  const history = items.filter((item) => item.statut === 'effectuee').sort((a, b) => (b.dateIntervention ?? '').localeCompare(a.dateIntervention ?? ''));
  const total = showCost ? history.reduce((sum, item) => sum + (item.cout ?? 0), 0) : 0;
  const icon = (item: MaintenanceItem) => {
    const source = DUE_TYPE_IMAGE[item.type];
    return source ? <Image source={source} accessible={false} style={{ width: 24, height: 24, tintColor: Brand.graphite }} resizeMode="contain" /> : null;
  };

  return (
    <View style={{ gap: 10 }}>
      <HText font="display" weight="bold" size={17} accessibilityRole="header">
        {t('maintenance.title')}
      </HText>
      {total > 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 16, borderWidth: 1, borderColor: Palette.border, backgroundColor: Brand.white, paddingHorizontal: 16, paddingVertical: 12 }}>
          <HText size={13} color={Palette.textSecondary}>
            {t('maintenance.totalCost')}
          </HText>
          <HText weight="bold" size={17}>{`${formatAmount(total)} MAD`}</HText>
        </View>
      ) : null}

      {items.length === 0 ? (
        <View style={{ borderRadius: 20, borderWidth: 1, borderStyle: 'dashed', borderColor: Palette.border, backgroundColor: Brand.white, padding: 16 }}>
          <HText size={13} color={Palette.textSecondary}>
            {t('vehicleDetail.maintenanceSection.empty')}
          </HText>
        </View>
      ) : (
        <View style={CARD}>
          {todo.length > 0 ? (
            <HText weight="semibold" size={11} track={0.14} color={Palette.textSecondary} style={{ marginBottom: 2 }}>
              {t('vehicleDetail.maintenanceSection.todo').toLocaleUpperCase()}
            </HText>
          ) : null}
          {todo.map(({ item, urgency }) => {
            const inProgress = item.statut === 'en_cours';
            const label = t(`maintenance.types.${item.type}`);
            const badge = inProgress ? { background: Palette.infoSoft, text: Palette.info, label: t('maintenance.status.en_cours') } : { ...URGENCY_COLOR[urgency], label: t(`maintenance.urgency.${urgency}`) };
            const detail = [item.echeanceDate ? dayText(item.echeanceDate, language) : null, item.echeanceKm != null ? `${formatAmount(item.echeanceKm)} km` : null].filter(Boolean).join(' · ');
            return (
              <View key={item.id} style={{ borderTopWidth: 1, borderTopColor: Brand.gaugeTrack }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, minHeight: 60 }}>
                  <Pressable onPress={() => router.push({ pathname: '/maintenance/[id]', params: { id: item.id } })} accessibilityRole="button" accessibilityLabel={`${label}${detail ? ` · ${detail}` : ''} · ${badge.label}`} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}>
                    <View style={{ width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.surfaceAlt }}>{icon(item)}</View>
                    <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                      <HText weight="semibold" size={14}>
                        {label}
                      </HText>
                      {detail ? (
                        <HText size={12} color={Palette.textSecondary}>
                          {detail}
                        </HText>
                      ) : null}
                      <View style={{ alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: badge.background }}>
                        <HText weight="semibold" size={11} color={badge.text}>
                          {badge.label}
                        </HText>
                      </View>
                    </View>
                  </Pressable>
                  <Pressable
                    onPress={() => setOpenId(openId === item.id ? null : item.id)}
                    accessibilityRole="button"
                    accessibilityLabel={t('vehicleDetail.quick.a11y', { label })}
                    style={{ minHeight: 44, minWidth: 72, paddingHorizontal: 14, borderRadius: 22, backgroundColor: Brand.graphite, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <HText weight="semibold" size={13} color={Brand.white}>
                      {t(inProgress ? 'vehicleDetail.quick.finish' : 'vehicleDetail.quick.button')}
                    </HText>
                  </Pressable>
                </View>
                {openId === item.id ? <QuickDoneCard item={item} vehicle={vehicle} now={now} showCost={showCost} onClose={() => setOpenId(null)} /> : null}
              </View>
            );
          })}

          {history.length > 0 ? (
            <HText weight="semibold" size={11} track={0.14} color={Palette.textSecondary} style={{ marginTop: todo.length > 0 ? 12 : 0, marginBottom: 2 }}>
              {t('vehicleDetail.maintenanceSection.history').toLocaleUpperCase()}
            </HText>
          ) : null}
          {history.map((item) => (
            <Pressable key={item.id} onPress={() => router.push({ pathname: '/maintenance/[id]', params: { id: item.id } })} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, minHeight: 52, borderTopWidth: 1, borderTopColor: Brand.gaugeTrack }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.successSoft }}>{icon(item)}</View>
              <View style={{ flex: 1, gap: 2 }}>
                <HText weight="semibold" size={14}>
                  {t(`maintenance.types.${item.type}`)}
                </HText>
                <HText size={12} color={Palette.textSecondary}>
                  {[item.dateIntervention ? dayText(item.dateIntervention, language) : null, item.garage].filter(Boolean).join(' · ')}
                </HText>
              </View>
              {showCost && item.cout != null ? <HText weight="bold" size={13}>{`${formatAmount(item.cout)} MAD`}</HText> : null}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

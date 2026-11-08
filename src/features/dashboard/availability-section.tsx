import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Brand, Palette } from '@/constants/theme';
import { useLanguage } from '@/i18n/use-language';

import { parseDayKey, sortBusy, sortFree, type DaySummary, type DayStatus, type VehicleDay } from './availability';
import { ArrowIcon, ArrowLink, HText, MicroLabel } from './home-ui';

const CAR: keyof typeof Ionicons.glyphMap = 'car-outline';

type Look = { box: string; icon: string; chipBg: string; chipFg: string; chipBorder?: string; glyph: keyof typeof Ionicons.glyphMap };
const LOOK: Record<Exclude<DayStatus, 'free'>, Look> = {
  late: { box: Palette.errorSoft, icon: Palette.error, chipBg: Palette.errorSoft, chipFg: Palette.error, glyph: CAR },
  inspection: { box: Palette.warningSoft, icon: Palette.warning, chipBg: Palette.warningSoft, chipFg: Palette.warning, glyph: CAR },
  maintenance: { box: Palette.warningSoft, icon: Palette.warning, chipBg: Palette.warningSoft, chipFg: Palette.warning, glyph: 'construct-outline' },
  unavailable: { box: Palette.surface, icon: Palette.textSecondary, chipBg: 'transparent', chipFg: Palette.textSecondary, chipBorder: Palette.textMuted, glyph: CAR },
  rented: { box: Palette.surface, icon: Brand.graphite, chipBg: Brand.graphite, chipFg: Brand.white, glyph: CAR },
  toConfirm: { box: Palette.surface, icon: Brand.graphite, chipBg: 'transparent', chipFg: Brand.graphite, chipBorder: Brand.graphite, glyph: CAR },
};

/**
 * « Disponibilités » : tout le parc, jour par jour sur 7 jours. Bande des jours (tap = jour sélectionné), barre de répartition,
 * véhicules libres (tap = nouvelle location pré-remplie), véhicules occupés (retard, entretien, inspection, louée…).
 */
export function AvailabilitySection({ days, error, onRetry }: { days: DaySummary[]; error: boolean; onRetry: () => void }) {
  const { t, language } = useLanguage();
  const locale = language === 'ar' ? 'ar-MA' : 'fr-FR';
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = days[Math.min(selectedIndex, days.length - 1)];

  const fmt = (date: Date, options: Intl.DateTimeFormatOptions) => date.toLocaleDateString(locale, options);
  const shortDay = (key: string) => fmt(parseDayKey(key), { weekday: 'short', day: 'numeric' });
  const month = days[0] ? fmt(days[0].date, { month: 'long' }) : '';
  const monthLabel = month.charAt(0).toLocaleUpperCase(locale) + month.slice(1);
  const titleDay = selectedIndex === 0 ? t('accueil.home.avail.todayTitle') : shortDay(selected?.key ?? '');
  const lastKey = days[days.length - 1]?.key ?? '';

  return (
    <View style={{ gap: 16 }}>
      <View style={{ paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 }}>
          <MicroLabel size={11} track={0.16}>
            {t('accueil.home.avail.title')}
          </MicroLabel>
          <HText size={12} color={Palette.textSecondary} numberOfLines={1}>
            {monthLabel}
          </HText>
        </View>
        <ArrowLink label={t('accueil.home.avail.planning')} onPress={() => router.push('/locations/calendrier')} />
      </View>

      {error || !selected ? (
        <View style={{ marginHorizontal: 20, alignItems: 'flex-start', gap: 10, borderWidth: 1, borderColor: Palette.border, borderRadius: 18, padding: 16, backgroundColor: Palette.surface }}>
          <HText size={13} color={Palette.textSecondary}>
            {t('accueil.home.avail.error')}
          </HText>
          <Pressable onPress={onRetry} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
            <HText weight="semibold" size={13}>
              {t('accueil.home.avail.retry')}
            </HText>
          </Pressable>
        </View>
      ) : (
        <>
          {/* Bande des 7 jours */}
          <View style={{ width: 0, minWidth: '100%' }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
              {days.map((day, index) => {
                const on = index === selectedIndex;
                const weekday = fmt(day.date, { weekday: 'short' }).replace(/\.$/, '').toLocaleUpperCase(locale);
                const longDay = fmt(day.date, { weekday: 'long', day: 'numeric', month: 'long' });
                return (
                  <Pressable
                    key={day.key}
                    onPress={() => setSelectedIndex(index)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={t('accueil.home.avail.a11y', { day: longDay, count: day.counts.free })}
                    style={{
                      width: 64,
                      height: 84,
                      borderRadius: 18,
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      borderWidth: 1,
                      borderColor: on ? Brand.graphite : Palette.border,
                      backgroundColor: on ? Brand.graphite : Palette.card,
                    }}
                  >
                    <HText weight="semibold" size={10} track={0.1} color={on ? Brand.mutedOnDark : index === 0 ? Brand.orange : Palette.textSecondary} style={{ lineHeight: 12 }}>
                      {index === 0 ? t('accueil.home.avail.todayShort') : weekday}
                    </HText>
                    <HText font="display" weight="semibold" size={18} color={on ? Brand.white : Palette.textPrimary} style={{ lineHeight: 20 }}>
                      {String(day.date.getDate())}
                    </HText>
                    <View style={{ borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: on ? Brand.orange : Palette.successSoft }}>
                      <HText weight="semibold" size={10} color={on ? Brand.white : Palette.success} style={{ lineHeight: 13 }}>
                        {t('accueil.home.avail.free', { count: day.counts.free })}
                      </HText>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View style={{ paddingHorizontal: 20, gap: 16 }}>
            <Distribution day={selected} />
          </View>

          {/* LIBRES */}
          <FreeBlock day={selected} titleDay={titleDay} shortDay={shortDay} />

          {/* OCCUPÉS */}
          <BusyBlock day={selected} titleDay={titleDay} shortDay={shortDay} lastKey={lastKey} />
        </>
      )}
    </View>
  );
}

function Distribution({ day }: { day: DaySummary }) {
  const { t } = useLanguage();
  const c = day.counts;
  const segments = [
    { key: 'free', color: Palette.success, value: c.free },
    { key: 'rented', color: Brand.graphite, value: c.rented },
    { key: 'late', color: Palette.error, value: c.late },
    { key: 'inspection', color: Brand.parcInspect, value: c.inspectionMaintenance },
    { key: 'unavailable', color: Brand.mutedOnDark, value: c.unavailable },
  ].filter((s) => s.value > 0);
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', gap: 3, height: 8 }}>
        {segments.map((s) => (
          <View key={s.key} style={{ flex: s.value, borderRadius: 4, backgroundColor: s.color }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
        {segments.map((s) => (
          <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.color }} />
            <HText size={12} color={Palette.textSecondary}>
              {t(`accueil.home.avail.legend.${s.key}`)}
            </HText>
            <HText weight="semibold" size={12}>
              {String(s.value)}
            </HText>
          </View>
        ))}
      </View>
    </View>
  );
}

function SectionHead({ title, color, count }: { title: string; color: string; count: number }) {
  const { t } = useLanguage();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 20 }}>
      <MicroLabel size={11} track={0.14} color={color}>
        {title}
      </MicroLabel>
      <HText size={12} color={Palette.textSecondary}>
        {t('accueil.home.avail.vehicles', { count })}
      </HText>
    </View>
  );
}

function FreeBlock({ day, titleDay, shortDay }: { day: DaySummary; titleDay: string; shortDay: (key: string) => string }) {
  const { t } = useLanguage();
  const free = sortFree(day.vehicles);
  return (
    <View style={{ gap: 10 }}>
      <SectionHead title={t('accueil.home.avail.freeTitle', { day: titleDay })} color={Palette.success} count={free.length} />
      <View style={{ width: 0, minWidth: '100%' }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
          {free.length === 0 ? (
            <View style={{ borderRadius: 18, backgroundColor: Palette.surface, padding: 14, justifyContent: 'center', minHeight: 64 }}>
              <HText size={13} color={Palette.textSecondary}>
                {t('accueil.home.avail.noneFree')}
              </HText>
            </View>
          ) : (
            free.map((v) => (
              <Pressable
                key={v.vehicleId}
                onPress={() => router.push({ pathname: '/locations/nouveau', params: { vehicleId: v.vehicleId, date: day.key } })}
                accessibilityRole="button"
                accessibilityLabel={`${v.label}. ${t('accueil.home.avail.book')}`}
                style={{ width: 158, borderWidth: 1, borderColor: Palette.border, borderRadius: 18, padding: 14, gap: 10, backgroundColor: Palette.card }}
              >
                <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: Palette.successSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={CAR} size={18} color={Palette.success} />
                </View>
                <View style={{ gap: 3 }}>
                  <HText weight="semibold" size={14} numberOfLines={1}>
                    {v.label}
                  </HText>
                  <HText size={12} color={Palette.textSecondary} numberOfLines={2}>
                    {v.freeUntil ? t('accueil.home.avail.freeUntil', { day: shortDay(v.freeUntil) }) : t('accueil.home.avail.freeOpen')}
                  </HText>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <HText weight="semibold" size={13}>
                    {t('accueil.home.avail.book')}
                  </HText>
                  <ArrowIcon color={Palette.primary} />
                </View>
              </Pressable>
            ))
          )}
        </ScrollView>
      </View>
    </View>
  );
}

function subtitle(v: VehicleDay, t: (key: string, o?: Record<string, unknown>) => string, shortDay: (key: string) => string, lastKey: string): { text: string; danger: boolean } {
  switch (v.status) {
    case 'late':
      return v.conflict
        ? { text: t('accueil.home.avail.sub.conflict', { day: shortDay(v.conflict.startDay) }), danger: true }
        : { text: t('accueil.home.avail.sub.late'), danger: false };
    case 'inspection':
      return { text: t('accueil.home.avail.sub.inspection'), danger: false };
    case 'maintenance':
      return { text: t(v.atGarage ? 'accueil.home.avail.sub.garage' : 'accueil.home.avail.sub.planned'), danger: false };
    case 'unavailable':
      return { text: t('accueil.home.avail.sub.unavailable'), danger: false };
    case 'toConfirm':
      return { text: t('accueil.home.avail.sub.toConfirm', { day: shortDay(v.startDay as string) }), danger: false };
    default:
      return (v.endDay as string) > lastKey
        ? { text: t('accueil.home.avail.sub.returnAfter', { day: shortDay(lastKey) }), danger: false }
        : { text: t('accueil.home.avail.sub.return', { day: shortDay(v.endDay as string) }), danger: false };
  }
}

function BusyBlock({ day, titleDay, shortDay, lastKey }: { day: DaySummary; titleDay: string; shortDay: (key: string) => string; lastKey: string }) {
  const { t } = useLanguage();
  const busy = sortBusy(day.vehicles);
  const open = (v: VehicleDay) => {
    if (v.status === 'late') router.push('/accueil/retards');
    else if ((v.status === 'rented' || v.status === 'toConfirm') && v.rentalId) router.push({ pathname: '/locations/[id]', params: { id: v.rentalId } });
    else router.push({ pathname: '/flotte/[id]', params: { id: v.vehicleId } });
  };
  return (
    <View style={{ gap: 10 }}>
      <SectionHead title={t('accueil.home.avail.busyTitle', { day: titleDay })} color={Palette.textPrimary} count={busy.length} />
      <View style={{ marginHorizontal: 20, borderWidth: 1, borderColor: Palette.border, borderRadius: 18, overflow: 'hidden', backgroundColor: Palette.card }}>
        {busy.length === 0 ? (
          <View style={{ padding: 14 }}>
            <HText size={13} color={Palette.textSecondary}>
              {t('accueil.home.avail.noneBusy')}
            </HText>
          </View>
        ) : (
          busy.map((v, index) => {
            const status = v.status as Exclude<DayStatus, 'free'>;
            const look = LOOK[status];
            const sub = subtitle(v, t, shortDay, lastKey);
            return (
              <Pressable
                key={v.vehicleId}
                onPress={() => open(v)}
                accessibilityRole="button"
                accessibilityLabel={`${v.label}. ${t(`accueil.home.avail.chip.${status}`)}. ${sub.text}`}
                style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: index === busy.length - 1 ? 0 : 1, borderBottomColor: Palette.surfaceAlt }}
              >
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: look.box, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={look.glyph} size={18} color={look.icon} />
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <HText weight="semibold" size={14} numberOfLines={1}>
                    {v.label}
                  </HText>
                  <HText size={12} color={sub.danger ? Palette.error : Palette.textSecondary} numberOfLines={2}>
                    {sub.text}
                  </HText>
                </View>
                <View style={{ borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: look.chipBg, borderWidth: look.chipBorder ? 1 : 0, borderColor: look.chipBorder }}>
                  <HText weight="semibold" size={11} color={look.chipFg} style={{ lineHeight: 15 }}>
                    {t(`accueil.home.avail.chip.${status}`)}
                  </HText>
                </View>
              </Pressable>
            );
          })
        )}
      </View>
    </View>
  );
}

import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { Brand, Palette } from '@/constants/theme';
import { HText, MicroLabel, formatAmount } from '@/features/dashboard/home-ui';
import { useLanguage } from '@/i18n/use-language';

import { formatDayLabel } from '../fleet-card';
import { calendarRuns, calendarTap, sparkPoints, type CalendarDay, type CalendarKind, type CalendarTap, type RevenueFigure } from './figures';

const CARD = { backgroundColor: Brand.white, borderWidth: 1, borderColor: Palette.border, borderRadius: 22 } as const;
const RING = 48;
const RING_STROKE = 6;
const RING_R = (RING - RING_STROKE) / 2;
const RING_LENGTH = 2 * Math.PI * RING_R;

function OccupancyRing({ percent }: { percent: number }) {
  const value = Math.min(100, Math.max(0, percent));
  return (
    <View style={{ width: RING, height: RING }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={RING} height={RING}>
        <Circle cx={RING / 2} cy={RING / 2} r={RING_R} fill="none" stroke={Brand.gaugeTrack} strokeWidth={RING_STROKE} />
        <Circle
          cx={RING / 2}
          cy={RING / 2}
          r={RING_R}
          fill="none"
          stroke={Palette.success}
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={[(RING_LENGTH * value) / 100, RING_LENGTH]}
          transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
        />
      </Svg>
      <View style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, alignItems: 'center', justifyContent: 'center' }}>
        <HText weight="bold" size={11}>{`${value}%`}</HText>
      </View>
    </View>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const { t } = useLanguage();
  const width = 120;
  const height = 48;
  const points = sparkPoints(values, width, height);
  const last = points[points.length - 1];
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={t('vehicleDetail.figures.curveA11y', { from: formatAmount(values[0] ?? 0), to: formatAmount(values[values.length - 1] ?? 0) })}>
      <Svg width={width} height={height}>
        <Polyline points={points.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke={Palette.primary} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        {last ? <Circle cx={last.x} cy={last.y} r={4.5} fill={Palette.primary} stroke={Brand.white} strokeWidth={2} /> : null}
      </Svg>
    </View>
  );
}

/** Prix par jour : « 500 MAD » ; « Modifier » transforme le montant en champ de saisie, au même endroit, avec Enregistrer / Annuler. */
function PriceBanner({ price, onSave }: { price: number; onSave?: (price: number) => Promise<boolean> }) {
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function open() {
    setDraft(String(price));
    setError(null);
    setEditing(true);
  }

  async function save() {
    const value = Number(draft.trim());
    if (draft.trim() === '' || !Number.isFinite(value) || value <= 0) return setError(t('vehicle.form.errors.invalid_price'));
    if (value === price) return setEditing(false);
    setBusy(true);
    setError(null);
    const ok = await onSave?.(value).catch(() => false);
    setBusy(false);
    if (ok) setEditing(false);
    else setError(t('vehicleDetail.figures.priceError'));
  }

  const link = { minHeight: 44, justifyContent: 'center' } as const;
  return (
    <View style={{ width: '100%', backgroundColor: Brand.graphite, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12, gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <HText size={13} color={Brand.mutedOnDark}>
          {t('vehicleDetail.figures.pricePerDay')}
        </HText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {editing ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderBottomWidth: 1.5, borderBottomColor: Brand.orangeLight }}>
                <TextInput
                  value={draft}
                  onChangeText={(value) => setDraft(value.replace(/[^\d]/g, ''))}
                  keyboardType="number-pad"
                  autoFocus
                  selectTextOnFocus
                  editable={!busy}
                  onSubmitEditing={() => void save()}
                  accessibilityLabel={t('vehicleDetail.figures.pricePerDay')}
                  style={{ minWidth: 70, paddingVertical: 4, fontSize: 18, fontWeight: '700', color: Brand.white, textAlign: 'right' }}
                />
                <HText weight="semibold" size={13} color={Brand.mutedOnDark}>
                  {t('vehicleDetail.figures.currency')}
                </HText>
              </View>
              <Pressable onPress={() => void save()} disabled={busy} accessibilityRole="button" accessibilityLabel={t('vehicleDetail.editor.save')} accessibilityState={{ disabled: busy, busy }} hitSlop={8} style={link}>
                <HText weight="semibold" size={12} color={Brand.orangeLight}>
                  {busy ? t('vehicleDetail.editor.saving') : t('vehicleDetail.editor.save')}
                </HText>
              </Pressable>
              <Pressable onPress={() => setEditing(false)} disabled={busy} accessibilityRole="button" accessibilityLabel={t('vehicleDetail.editor.cancel')} hitSlop={8} style={link}>
                <HText weight="semibold" size={12} color={Brand.mutedOnDark}>
                  {t('vehicleDetail.editor.cancel')}
                </HText>
              </Pressable>
            </>
          ) : (
            <>
              <HText font="display" weight="bold" size={18} color={Brand.white}>
                {`${formatAmount(price)} ${t('vehicleDetail.figures.currency')}`}
              </HText>
              {onSave ? (
                <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={t('vehicleDetail.figures.priceEdit')} hitSlop={8} style={link}>
                  <HText weight="semibold" size={12} color={Brand.orangeLight}>
                    {t('vehicle.edit')}
                  </HText>
                </Pressable>
              ) : null}
            </>
          )}
        </View>
      </View>
      {error ? (
        <HText size={12} color={Brand.errorOnDark} accessibilityRole="alert">
          {error}
        </HText>
      ) : null}
    </View>
  );
}

export type KeyFiguresProps = {
  /** Propriétaire seulement : revenus, encaissé, prix par jour. Absent pour les autres rôles. */
  money?: { revenue: RevenueFigure; curve: number[]; cashed: number | null; pricePerDay: number; /** Enregistre le nouveau prix par jour ; vrai si c'est enregistré. Absent : pas de bouton « Modifier ». */ onSavePrice?: (price: number) => Promise<boolean> };
  occupation: number;
  rentals: number;
};

/** Chiffres clés : revenus 30 jours (avec variation et courbe de 6 mois), occupation, locations depuis l'ajout, prix par jour. */
export function KeyFigures({ money, occupation, rentals }: KeyFiguresProps) {
  const { t } = useLanguage();
  const variation = money?.revenue.variation ?? null;
  const variationText = variation === null ? null : variation > 0 ? t('vehicleDetail.figures.variationUp', { n: variation }) : variation < 0 ? t('vehicleDetail.figures.variationDown', { n: Math.abs(variation) }) : t('vehicleDetail.figures.variationFlat');
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {money ? (
        <View style={[CARD, { width: '100%', padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }]}>
          <View
            accessible
            accessibilityLabel={[t('vehicleDetail.figures.revenueA11y', { amount: formatAmount(money.revenue.current) }), variationText, money.cashed !== null ? t('vehicleDetail.figures.cashed', { amount: formatAmount(money.cashed) }) : null].filter(Boolean).join('. ')}
            style={{ flex: 1, gap: 4 }}
          >
            <MicroLabel color={Palette.textSecondary}>{t('vehicleDetail.figures.revenue')}</MicroLabel>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <HText font="display" weight="bold" size={30} track={-0.02}>
                {formatAmount(money.revenue.current)}
              </HText>
              <HText weight="semibold" size={13} color={Palette.textSecondary}>
                {t('vehicleDetail.figures.currency')}
              </HText>
            </View>
            {variationText ? (
              <HText weight="semibold" size={12} color={variation !== null && variation < 0 ? Palette.error : variation === 0 ? Palette.textSecondary : Palette.success}>
                {variationText}
              </HText>
            ) : money.revenue.current === 0 ? (
              <HText size={12} color={Palette.textSecondary}>
                {t('vehicleDetail.figures.noRevenue')}
              </HText>
            ) : null}
            {money.cashed !== null ? (
              <HText size={12} color={Palette.textSecondary}>
                {t('vehicleDetail.figures.cashed', { amount: formatAmount(money.cashed) })}
              </HText>
            ) : null}
          </View>
          <Sparkline values={money.curve} />
        </View>
      ) : null}

      <View accessible accessibilityLabel={t('vehicleDetail.figures.occupationA11y', { percent: occupation })} style={[CARD, { flexGrow: 1, flexBasis: '45%', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
        <OccupancyRing percent={occupation} />
        <View style={{ flex: 1, gap: 2 }}>
          <HText weight="semibold" size={12} numberOfLines={1}>
            {t('vehicleDetail.figures.occupation')}
          </HText>
          <HText size={11} color={Palette.textSecondary}>
            {t('vehicleDetail.figures.occupationSub')}
          </HText>
        </View>
      </View>

      <View accessible style={[CARD, { flexGrow: 1, flexBasis: '45%', padding: 14, justifyContent: 'center', gap: 2 }]}>
        <HText font="display" weight="bold" size={26}>
          {String(rentals)}
        </HText>
        <HText size={11} color={Palette.textSecondary}>
          {t('vehicleDetail.figures.rentals')}
        </HText>
      </View>

      {money ? <PriceBanner price={money.pricePerDay} onSave={money.onSavePrice} /> : null}
    </View>
  );
}

const KIND_STYLE: Record<CalendarKind, { background: string; border: string; ink: string }> = {
  free: { background: Palette.successSoft, border: Palette.success, ink: Palette.success },
  rented: { background: Brand.graphite, border: Brand.graphite, ink: Brand.white },
  immobilised: { background: Palette.warning, border: Palette.warning, ink: Brand.graphite },
  late: { background: Palette.error, border: Palette.error, ink: Brand.white },
};

/** Frise des 14 prochains jours : 2 rangées de 7. Appui sur un jour loué → la location ; sur un jour libre → nouvelle location à partir de ce jour. */
export function FourteenDays({ days, now, onTap }: { days: CalendarDay[]; now: Date; onTap: (tap: NonNullable<CalendarTap>) => void }) {
  const { t, language } = useLanguage();
  if (days.length === 0) return null;
  const locale = language === 'ar' ? 'ar-MA' : 'fr-FR';
  const stateText = (kind: CalendarKind) => t(`vehicleDetail.calendar.${kind}`);
  const dayText = (key: string) => formatDayLabel(key, language, 'short', now);
  const runs = calendarRuns(days);
  const summary =
    runs.length === 1
      ? t('vehicleDetail.calendar.summaryAll', { state: stateText(runs[0].kind) })
      : runs.map((run) => (run.firstDay === run.lastDay ? t('vehicleDetail.calendar.summaryDay', { state: stateText(run.kind), day: dayText(run.firstDay) }) : t('vehicleDetail.calendar.summaryRun', { state: stateText(run.kind), from: dayText(run.firstDay), to: dayText(run.lastDay) }))).join('. ');
  const rows = [days.slice(0, 7), days.slice(7, 14)];

  return (
    <View style={[CARD, { borderRadius: 24, padding: 16, gap: 14 }]}>
      <HText font="display" weight="bold" size={17}>
        {t('vehicleDetail.calendar.title')}
      </HText>
      <View accessible accessibilityLabel={summary} style={{ gap: 6 }} importantForAccessibility="yes">
        {rows.map((row, index) => (
          <View key={index} style={{ flexDirection: 'row', gap: 6 }}>
            {row.map((day) => {
              const style = KIND_STYLE[day.kind];
              const tap = calendarTap(day);
              const weekday = day.date.toLocaleDateString(locale, { weekday: 'narrow' });
              const content = (
                <>
                  <HText size={10} color={style.ink} style={{ opacity: 0.8 }}>
                    {weekday}
                  </HText>
                  <HText weight="bold" size={14} color={style.ink}>
                    {String(day.date.getDate())}
                  </HText>
                </>
              );
              const box = { flex: 1, minHeight: 48, borderRadius: 12, borderWidth: 1, backgroundColor: style.background, borderColor: style.border, alignItems: 'center', justifyContent: 'center', gap: 1 } as const;
              return tap ? (
                <Pressable
                  key={day.key}
                  onPress={() => onTap(tap)}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('vehicleDetail.calendar.dayA11y', { day: dayText(day.key), state: stateText(day.kind) })}${tap.type === 'rent' ? `. ${t('vehicleDetail.calendar.rentFrom')}` : ''}`}
                  style={box}
                >
                  {content}
                </Pressable>
              ) : (
                <View key={day.key} style={box}>
                  {content}
                </View>
              );
            })}
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
        {(['free', 'rented', 'immobilised', 'late'] as const).map((kind) => (
          <View key={kind} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: KIND_STYLE[kind].background, borderWidth: 1, borderColor: KIND_STYLE[kind].border }} />
            <HText size={11} color={Palette.textSecondary}>
              {stateText(kind)}
            </HText>
          </View>
        ))}
      </View>
    </View>
  );
}

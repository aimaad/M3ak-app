import { Brand, Palette } from '@/constants/theme';

/** Thème commun de tous les calendriers de l'app : fond blanc, chiffres foncés, sélection graphite, jamais de texte pâle sur fond pâle. */
export const CALENDAR_THEME = {
  calendarBackground: Palette.card,
  backgroundColor: Palette.card,
  textSectionTitleColor: Palette.textSecondary,
  dayTextColor: Palette.textPrimary,
  textDisabledColor: Palette.textMuted,
  monthTextColor: Palette.textPrimary,
  arrowColor: Brand.graphite,
  disabledArrowColor: Palette.textMuted,
  todayTextColor: Brand.graphite,
  todayBackgroundColor: Palette.primarySoft,
  selectedDayBackgroundColor: Brand.graphite,
  selectedDayTextColor: Brand.white,
  dotColor: Palette.primary,
  selectedDotColor: Brand.white,
  textDayFontFamily: 'Cairo_500Medium',
  textMonthFontFamily: 'Cairo_700Bold',
  textDayHeaderFontFamily: 'Cairo_600SemiBold',
  textDayFontSize: 15,
  textMonthFontSize: 18,
  textDayHeaderFontSize: 12,
} as const;

/** Jour déjà réservé (non sélectionnable) : pastille rouge pâle, chiffre rouge foncé, bien lisible. */
export const BOOKED_DAY_MARK = {
  disabled: true,
  disableTouchEvent: true,
  startingDay: true,
  endingDay: true,
  color: Palette.errorSoft,
  textColor: Palette.error,
} as const;

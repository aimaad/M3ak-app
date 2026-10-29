import { M3akPalette } from '@/constants/theme';

/** Thème commun de tous les calendriers de l'app : fond blanc, chiffres foncés, sélection violette, jamais de texte pâle sur fond pâle. */
export const CALENDAR_THEME = {
  calendarBackground: '#FFFFFF',
  backgroundColor: '#FFFFFF',
  textSectionTitleColor: M3akPalette.muted,
  dayTextColor: M3akPalette.ink,
  textDisabledColor: M3akPalette.subtle,
  monthTextColor: M3akPalette.ink,
  arrowColor: M3akPalette.mauve,
  disabledArrowColor: M3akPalette.subtle,
  todayTextColor: M3akPalette.mauveDeep,
  todayBackgroundColor: M3akPalette.mauveLight,
  selectedDayBackgroundColor: M3akPalette.mauve,
  selectedDayTextColor: '#FFFFFF',
  dotColor: M3akPalette.mauve,
  selectedDotColor: '#FFFFFF',
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
  color: '#FEE2E2',
  textColor: '#B91C1C',
} as const;

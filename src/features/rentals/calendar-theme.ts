import { BibipPalette } from '@/constants/theme';

/** Thème commun de tous les calendriers de l'app : fond blanc, chiffres foncés, sélection violette, jamais de texte pâle sur fond pâle. */
export const CALENDAR_THEME = {
  calendarBackground: '#FFFFFF',
  backgroundColor: '#FFFFFF',
  textSectionTitleColor: BibipPalette.muted,
  dayTextColor: BibipPalette.ink,
  textDisabledColor: BibipPalette.subtle,
  monthTextColor: BibipPalette.ink,
  arrowColor: BibipPalette.primary,
  disabledArrowColor: BibipPalette.subtle,
  todayTextColor: BibipPalette.primaryDeep,
  todayBackgroundColor: BibipPalette.primaryLight,
  selectedDayBackgroundColor: BibipPalette.primary,
  selectedDayTextColor: '#FFFFFF',
  dotColor: BibipPalette.primary,
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
  color: '#FBE8E6',
  textColor: '#A8322B',
} as const;

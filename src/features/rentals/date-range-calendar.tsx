import { Calendar, type DateData } from 'react-native-calendars';

import { useLanguage } from '@/i18n/use-language';

import { setCalendarLocale } from './calendar-locale';
import { BOOKED_DAY_MARK, CALENDAR_THEME } from './calendar-theme';

export type DateRangeValue = { start: string | null; end: string | null };

type DateRangeCalendarProps = {
  disabledDates: string[];
  value: DateRangeValue;
  onChange: (range: DateRangeValue) => void;
  minDate?: string;
};

const COLOR_PRIMARY = '#7C3AED';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function isBetween(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

function rangeHitsDisabled(disabledDates: string[], start: string, end: string): boolean {
  return disabledDates.some((date) => isBetween(date, start, end));
}

export function buildMarkedDates(
  disabledDates: string[],
  range: DateRangeValue
): Record<string, object> {
  const marks: Record<string, object> = {};

  for (const date of disabledDates) {
    marks[date] = { ...BOOKED_DAY_MARK };
  }

  if (range.start && range.end) {
    let cursor = range.start;
    while (cursor <= range.end) {
      marks[cursor] = {
        ...marks[cursor],
        color: COLOR_PRIMARY,
        textColor: '#FFFFFF',
        startingDay: cursor === range.start,
        endingDay: cursor === range.end,
      };
      const next = new Date(`${cursor}T00:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      cursor = next.toISOString().slice(0, 10);
    }
  } else if (range.start) {
    marks[range.start] = {
      ...marks[range.start],
      startingDay: true,
      endingDay: true,
      color: COLOR_PRIMARY,
      textColor: '#FFFFFF',
    };
  }

  return marks;
}

export function DateRangeCalendar({ disabledDates, value, onChange, minDate }: DateRangeCalendarProps) {
  const { language } = useLanguage();
  setCalendarLocale(language);

  function handleDayPress(day: DateData) {
    const date = day.dateString;
    if (disabledDates.includes(date)) return;

    if (!value.start || (value.start && value.end)) {
      onChange({ start: date, end: null });
      return;
    }

    if (date < value.start) {
      onChange({ start: date, end: null });
      return;
    }

    if (rangeHitsDisabled(disabledDates, value.start, date)) {
      onChange({ start: date, end: null });
      return;
    }

    onChange({ start: value.start, end: date });
  }

  return (
    <Calendar
      minDate={minDate ?? todayISO()}
      markingType="period"
      markedDates={buildMarkedDates(disabledDates, value)}
      onDayPress={handleDayPress}
      firstDay={1}
      enableSwipeMonths
      theme={CALENDAR_THEME}
      style={{ borderRadius: 24, overflow: 'hidden' }}
    />
  );
}

import type { DayOfWeek } from '../types/timetable';

export const DAYS_ORDER: DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export interface WeekDayInfo {
  day: DayOfWeek;
  dateStr: string; // YYYY-MM-DD
  dayNumber: number;
  monthName: string;
  shortDate: string; // e.g. "1 Oct"
  fullDate: string; // e.g. "Thursday, 1 Oct 2026"
  shortWeekday: string; // e.g. "Thu"
  isToday: boolean;
}

/**
 * Get formatted information for all days of the current week (Monday - Saturday)
 */
export function getCurrentWeekDates(referenceDate: Date = new Date()): WeekDayInfo[] {
  // In JS getDay(): Sunday = 0, Monday = 1 ... Saturday = 6
  // We want Monday = 0, Sunday = 6
  const currentDayIndex = (referenceDate.getDay() + 6) % 7;

  // Find Monday of the current week
  const monday = new Date(referenceDate);
  monday.setDate(referenceDate.getDate() - currentDayIndex);
  monday.setHours(0, 0, 0, 0);

  const todayStr = getIsoDateString(referenceDate);

  return DAYS_ORDER.slice(0, 6).map((dayName, idx) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + idx);

    const dateStr = getIsoDateString(d);
    const dayNumber = d.getDate();
    const monthName = d.toLocaleDateString('en-US', { month: 'short' });
    const shortDate = `${dayNumber} ${monthName}`;
    const fullDate = d.toLocaleDateString('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const shortWeekday = dayName.substring(0, 3);
    const isToday = dateStr === todayStr;

    return {
      day: dayName,
      dateStr,
      dayNumber,
      monthName,
      shortDate,
      fullDate,
      shortWeekday,
      isToday,
    };
  });
}

/**
 * Formats a Date object to YYYY-MM-DD in local time
 */
export function getIsoDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Get today's DayOfWeek name (e.g. 'Monday', 'Tuesday', etc.)
 */
export function getTodayDayName(date: Date = new Date()): DayOfWeek {
  const dayIndex = (date.getDay() + 6) % 7;
  return DAYS_ORDER[dayIndex] || 'Monday';
}

/**
 * Formats a YYYY-MM-DD date string with friendly relative tags (Today, Yesterday)
 */
export function formatFriendlyDate(dateStr: string): string {
  if (!dateStr) return '';
  const todayStr = getIsoDateString(new Date());

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getIsoDateString(yesterday);

  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);

    const formatted = dateObj.toLocaleDateString('en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    if (dateStr === todayStr) {
      return `Today (${formatted})`;
    }
    if (dateStr === yesterdayStr) {
      return `Yesterday (${formatted})`;
    }
    return formatted;
  } catch {
    return dateStr;
  }
}

/**
 * Check if the current time falls inside a slot's time range
 */
export function isSlotHappeningNow(startTime: string, endTime: string, now: Date = new Date()): boolean {
  try {
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const [sH, sM] = startTime.split(':').map(Number);
    const [eH, eM] = endTime.split(':').map(Number);
    const startMins = sH * 60 + sM;
    const endMins = eH * 60 + eM;
    return currentMins >= startMins && currentMins < endMins;
  } catch {
    return false;
  }
}

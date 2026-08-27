import type { Language } from '@/i18n';
import { localeOf } from '@/i18n';

/** "3 h 20 min" / "45 min" — durations a baker can act on, never "3.33 hours". */
export function formatDuration(minutes: number, t: (k: string) => string): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} ${t('unit.minutes')}`;
  if (m === 0) return `${h} ${t('unit.hours')}`;
  return `${h} ${t('unit.hours')} ${m} ${t('unit.minutes')}`;
}

/** Hours as "18 h" or "4,5 h", using the locale's decimal separator. */
export function formatHours(hours: number, lang: Language): string {
  const rounded = Math.round(hours * 10) / 10;
  return new Intl.NumberFormat(localeOf(lang), { maximumFractionDigits: 1 }).format(rounded);
}

export function formatClock(iso: string, lang: Language): string {
  return new Intl.DateTimeFormat(localeOf(lang), {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function formatDateTime(iso: string, lang: Language): string {
  return new Intl.DateTimeFormat(localeOf(lang), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function formatDate(iso: string, lang: Language): string {
  return new Intl.DateTimeFormat(localeOf(lang), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

/**
 * Which calendar day a step falls on, relative to the schedule's start.
 * Steps before day 1 belong to the preferment built the evening before.
 */
export function dayIndex(startIso: string, stepIso: string): number {
  const start = new Date(startIso);
  const step = new Date(stepIso);
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const stepDay = new Date(step.getFullYear(), step.getMonth(), step.getDate()).getTime();
  return Math.round((stepDay - startDay) / 86_400_000);
}

/** Weights below 10 g need two decimals — a 0.4 g yeast dose is not "0 g". */
export function formatGrams(grams: number, lang: Language): string {
  const locale = localeOf(lang);
  if (grams === 0) return '0';
  if (grams < 10) {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(grams);
  }
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(grams);
}

/** Baker's percentages always carry two decimals, as the spec asks. */
export function formatPercent(value: number, lang: Language): string {
  return new Intl.NumberFormat(localeOf(lang), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number, lang: Language, decimals = 1): string {
  return new Intl.NumberFormat(localeOf(lang), { maximumFractionDigits: decimals }).format(value);
}

/** Local `datetime-local` input value from a Date, without dragging in a date library. */
export function toDateTimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * A timeline step's interpolation values, with any nested i18n keys resolved.
 * A fold's `technique` arrives as a key of its own and has to be translated
 * before it can be interpolated into the step body.
 */
export function resolveStepValues(
  values: Record<string, string | number> | undefined,
  t: (key: string) => string,
): Record<string, string | number> | undefined {
  if (!values?.technique) return values;
  return { ...values, technique: t(String(values.technique)) };
}

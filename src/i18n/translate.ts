/**
 * The translator, with no React in it.
 *
 * The UI wraps this in a context, and the MCP server calls it directly to turn
 * the engine's i18n keys into prose for an assistant. Keeping it framework-free
 * is what lets one dictionary serve both.
 */

import { sv } from './sv';
import { en } from './en';
import { stylesSv } from './styles.sv';
import { stylesEn } from './styles.en';

export type Language = 'sv' | 'en';

export const DICTIONARIES: Record<Language, Record<string, string>> = {
  sv: { ...sv, ...stylesSv },
  en: { ...en, ...stylesEn },
};

export type Translator = (key: string, values?: Record<string, string | number>) => string;

/**
 * Fill `{placeholders}`, leaving unknown ones visible so gaps are obvious.
 * Numbers are written the way the language writes them — "2,1 h" in Swedish,
 * not "2.1 h" — when a locale is given.
 */
export function interpolate(
  template: string,
  values?: Record<string, string | number>,
  locale?: string,
): string {
  if (!values) return template;
  const format = locale
    ? new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format
    : String;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    if (!(name in values)) return match;
    const value = values[name];
    return typeof value === 'number' ? format(value) : String(value);
  });
}

/**
 * A translator bound to one language. A missing key falls back to the other
 * language before giving up — showing a baker `note.cold_retard` is never right.
 */
export function createTranslator(lang: Language): Translator {
  const primary = DICTIONARIES[lang];
  const fallback = DICTIONARIES[lang === 'sv' ? 'en' : 'sv'];
  const locale = localeOf(lang);
  return (key, values) => {
    const template = primary[key] ?? fallback[key];
    if (template === undefined) return key;
    return interpolate(template, values, locale);
  };
}

export const localeOf = (lang: Language): string => (lang === 'sv' ? 'sv-SE' : 'en-GB');

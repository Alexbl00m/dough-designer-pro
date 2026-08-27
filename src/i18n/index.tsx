import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { DICTIONARIES, createTranslator, localeOf } from './translate';
import type { Language, Translator } from './translate';

export type { Language, Translator };
export { localeOf, createTranslator };

const STORAGE_KEY = 'bakers-calculator:lang';

interface I18nContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  t: Translator;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function detectLanguage(): Language {
  if (typeof window === 'undefined') return 'sv';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'sv' || stored === 'en') return stored;
  } catch {
    // Private mode or blocked storage — fall through to the browser preference.
  }
  return (window.navigator?.language ?? '').toLowerCase().startsWith('sv') ? 'sv' : 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(detectLanguage);

  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Not remembering the choice is not worth breaking the page over.
    }
  }, [lang]);

  const setLang = useCallback((next: Language) => setLangState(next), []);
  const t = useMemo(() => createTranslator(lang), [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}

/** Shorthand for components that only need the translator. */
export const useT = (): Translator => useI18n().t;

/** Exposed for tests and tooling that need to assert key coverage. */
export { DICTIONARIES };

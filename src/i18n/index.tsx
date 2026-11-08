import React from 'react';
import { PL, PL_PLURALS } from './pl';

// UI language. Everyone sees English; only the super admin can switch to Polish (stored server-side with the
// account, so the AI replies follow too). Strings are written in English inside t('…'); the Polish dictionary
// maps the same English text to Polish, and a missing entry falls back to English.

export type Lang = 'en' | 'pl';
export type Vars = Record<string, string | number>;

function fill(text: string, vars?: Vars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

export function translate(lang: Lang, text: string, vars?: Vars): string {
  return fill(lang === 'pl' ? (PL[text] ?? text) : text, vars);
}

/** "1 option" / "3 options"; in Polish 1 / 2–4 / 5+ forms from PL_PLURALS (keyed by the English singular). */
export function plural(lang: Lang, n: number, one: string, other: string): string {
  if (lang === 'pl' && PL_PLURALS[one]) {
    const [p1, few, many] = PL_PLURALS[one];
    const isFew = n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14);
    return `${n} ${n === 1 ? p1 : isFew ? few : many}`;
  }
  return `${n} ${n === 1 ? one : other}`;
}

export interface I18n {
  lang: Lang;
  locale: string;
  t: (text: string, vars?: Vars) => string;
  tp: (n: number, one: string, other: string) => string;
}

function make(lang: Lang): I18n {
  return {
    lang,
    locale: lang === 'pl' ? 'pl-PL' : 'en-GB',
    t: (text, vars) => translate(lang, text, vars),
    tp: (n, one, other) => plural(lang, n, one, other),
  };
}

const EN = make('en');
const I18nContext = React.createContext<I18n>(EN);

export function I18nProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  const value = React.useMemo(() => (lang === 'pl' ? make('pl') : EN), [lang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  return React.useContext(I18nContext);
}

/** Shorthand when only t() is needed. */
export function useT() {
  return React.useContext(I18nContext).t;
}

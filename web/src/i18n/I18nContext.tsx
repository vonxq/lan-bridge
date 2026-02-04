import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Locale, localeNames, getDefaultLocale, saveLocale, createT, TFunction } from './index';

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TFunction;
  localeNames: Record<Locale, string>;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getDefaultLocale);
  const [t, setT] = useState<TFunction>(() => createT(locale));

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    setT(() => createT(newLocale));
    saveLocale(newLocale);
  }, []);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, localeNames }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextType {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}

// 便捷 hook，只获取 t 函数
export function useTranslation(): TFunction {
  return useI18n().t;
}

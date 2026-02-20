import React, { createContext, useContext, useMemo } from 'react';
import type { Locale, Translations } from './types';
import ko from './ko';
import en from './en';

interface LanguageContextValue {
  t: Translations;
  locale: Locale;
  setLocale: (l: Locale) => void;
}

const translations: Record<Locale, Translations> = { ko, en };

const LanguageContext = createContext<LanguageContextValue>({
  t: ko,
  locale: 'ko',
  setLocale: () => {},
});

export const useTranslation = () => useContext(LanguageContext);

interface LanguageProviderProps {
  locale: Locale;
  setLocale: (l: Locale) => void;
  children: React.ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({
  locale,
  setLocale,
  children,
}) => {
  const value = useMemo<LanguageContextValue>(
    () => ({ t: translations[locale], locale, setLocale }),
    [locale, setLocale],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

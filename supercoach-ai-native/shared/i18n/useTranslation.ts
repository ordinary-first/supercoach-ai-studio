import { createContext, useContext } from 'react';
import { getTranslations } from './index';
import type { TranslationStrings, AppLanguage } from './types';

interface LanguageContextValue {
  language: AppLanguage;
  t: TranslationStrings;
  setLanguage: (lang: AppLanguage) => void;
}

export const LanguageContext = createContext<LanguageContextValue>({
  language: 'en',
  t: getTranslations('en'),
  setLanguage: () => {},
});

export const useTranslation = (): LanguageContextValue =>
  useContext(LanguageContext);

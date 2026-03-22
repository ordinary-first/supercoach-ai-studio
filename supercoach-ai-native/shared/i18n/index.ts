import ko from './ko';
import en from './en';
import type { TranslationStrings } from './types';
import type { AppLanguage } from './types';

const translations: Record<AppLanguage, TranslationStrings> = { en, ko };

export const getTranslations = (lang: AppLanguage): TranslationStrings =>
  translations[lang] ?? translations.en;

export type { TranslationStrings, AppLanguage };
export { ko, en };

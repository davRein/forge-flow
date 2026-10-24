import { createContext, useContext } from 'react';
import type { AppLanguage } from '../types/settings.types';
import { translate } from '../services/i18n/translate';
import type { TranslationParameters } from '../services/i18n/translate';

export const LanguageContext = createContext<AppLanguage>('en');

export function useTranslation() {
    const language = useContext(LanguageContext);
    return { language, locale: language === 'en' ? 'en-GB' : 'de-DE',
        t: (text: string, parameters?: TranslationParameters) => translate(text, language, parameters) };
}

export function useSettingsText() { return useTranslation().t; }

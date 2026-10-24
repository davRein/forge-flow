import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { LanguageContext } from '../hooks/languageContext';
import type { AppLanguage } from '../types/settings.types';

export default function LanguageProvider({ language, children }: { language: AppLanguage; children: ReactNode }) {
    useEffect(() => { document.documentElement.lang = language; }, [language]);
    return <LanguageContext.Provider value={language}>{children}</LanguageContext.Provider>;
}

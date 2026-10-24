import type { AppLanguage } from '../../types/settings.types';

const storageKey = 'forgeflow.language';
type Environment = { storage: () => Pick<Storage, 'getItem' | 'setItem'>; locale: () => string | undefined };

export function languageForRegion(locale?: string): AppLanguage {
    try {
        const region = locale ? new Intl.Locale(locale).region : undefined;
        return region === 'DE' || region === 'AT' || region === 'CH' ? 'de' : 'en';
    } catch {
        return 'en';
    }
}

export function createLanguagePreference(environment: Environment) {
    let sessionLanguage: AppLanguage | null = null;
    return {
        getLanguage(): AppLanguage {
            if (sessionLanguage) return sessionLanguage;
            try {
                const stored = environment.storage().getItem(storageKey);
                if (stored === 'de' || stored === 'en') return stored;
            } catch { /* Storage can be disabled; region detection still works. */ }
            return languageForRegion(environment.locale());
        },
        remember(language: AppLanguage): void {
            sessionLanguage = language;
            try { environment.storage().setItem(storageKey, language); }
            catch { /* Retain the choice for this page session if persistence is unavailable. */ }
        }
    };
}

const browserPreference = createLanguagePreference({
    storage: () => window.localStorage,
    locale: () => typeof navigator === 'undefined' ? undefined : navigator.languages?.[0] || navigator.language
});
export const getBrowserLanguage = browserPreference.getLanguage;
export const rememberBrowserLanguage = browserPreference.remember;

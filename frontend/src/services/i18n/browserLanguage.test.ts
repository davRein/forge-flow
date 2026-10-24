import { createLanguagePreference, languageForRegion } from './browserLanguage.js';

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }

export const browserLanguageTests = [
    { name: 'Nur eine erkennbare Browserregion DE, AT oder CH wählt Deutsch; sonst Englisch', run() {
        for (const locale of ['de-DE', 'de-AT', 'de-CH', 'en-DE', 'fr-CH', 'de-Latn-AT', 'en-ch']) {
            assert(languageForRegion(locale) === 'de', `German region missing: ${locale}`);
        }
        for (const locale of [undefined, '', 'de', 'en', 'de-US', 'en-GB', 'fr-FR', 'not_a_locale', 'de-u-rg-dezzzz']) {
            assert(languageForRegion(locale) === 'en', `Unexpected German default: ${locale}`);
        }
    } },
    { name: 'Explizites Englisch überlebt neuen Seitenaufruf in DE und explizites Deutsch gilt außerhalb DACH', run() {
        const values = new Map<string, string>();
        const environment = { locale: () => 'de-DE', storage: () => ({ getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } }) };
        const first = createLanguagePreference(environment);
        assert(first.getLanguage() === 'de', 'Initial region missing');
        assert(values.size === 0, 'Detection must not persist an explicit preference');
        first.remember('en');
        assert(createLanguagePreference(environment).getLanguage() === 'en', 'English must survive reload');
        createLanguagePreference(environment).remember('de');
        assert(createLanguagePreference({ ...environment, locale: () => 'en-US' }).getLanguage() === 'de', 'Explicit German must override region');
        assert(Array.from(values.keys()).length === 1 && values.get('forgeflow.language') === 'de', 'Only the language code may be stored');
    } },
    { name: 'Ungültiger oder gesperrter Browserspeicher verhindert weder Login noch Sprachwechsel', run() {
        const invalid = createLanguagePreference({ locale: () => undefined, storage: () => ({ getItem: () => '{"language":"de"}', setItem() {} }) });
        assert(invalid.getLanguage() === 'en', 'Invalid preference must not be accepted');
        const blocked = createLanguagePreference({ locale: () => 'de-DE', storage: () => { throw new Error('denied'); } });
        assert(blocked.getLanguage() === 'de', 'Region fallback missing');
        blocked.remember('en'); assert(blocked.getLanguage() === 'en', 'Session fallback missing');
        const quota = createLanguagePreference({ locale: () => 'en-US', storage: () => ({ getItem: () => 'de', setItem() { throw new Error('quota'); } }) });
        quota.remember('en'); assert(quota.getLanguage() === 'en', 'Stale storage must not override a current choice');
    } }
];

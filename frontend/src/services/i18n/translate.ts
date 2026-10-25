import type { AppLanguage } from '../../types/settings.types';
import { settingsEnglish } from '../../config/settingsTranslations.js';
import { wikiEnglish } from '../../config/wikiTranslations.js';
import { toolsEnglish } from '../../config/toolsTranslations.js';
import { commonEnglish } from '../../config/commonTranslations.js';
import { chatEnglish } from '../../config/chatTranslations.js';
import { timeEnglish } from '../../config/timeTranslations.js';
import { businessEnglish } from '../../config/businessTranslations.js';

export type TranslationValue = string | { one: string; other: string };
export type TranslationParameters = Readonly<Record<string, string | number>>;
const english: Readonly<Record<string, TranslationValue>> = { ...settingsEnglish, ...commonEnglish, ...wikiEnglish, ...toolsEnglish, ...chatEnglish, ...timeEnglish, ...businessEnglish };

// These patterns only describe application-generated diagnostics, not user content.
const diagnostics: { pattern: RegExp; key: string; names: string[] }[] = [
    { pattern: /^Ungültiges JSON: ([\s\S]*)$/, key: 'Ungültiges JSON: {detail}', names: ['detail'] },
    { pattern: /^Zahl oder Klammer an Position (\d+) erwartet\.$/, key: 'Zahl oder Klammer an Position {position} erwartet.', names: ['position'] },
    { pattern: /^Unerwartetes Zeichen an Position (\d+)\.$/, key: 'Unerwartetes Zeichen an Position {position}.', names: ['position'] },
    { pattern: /^Die Ziffer „([0-9a-f])“ ist in Basis (\d+) nicht erlaubt\.$/i, key: 'Die Ziffer „{digit}“ ist in Basis {base} nicht erlaubt.', names: ['digit', 'base'] },
    { pattern: /^Zeitlimit von (\d+) Sekunden erreicht\.$/, key: 'Zeitlimit von {seconds} Sekunden erreicht.', names: ['seconds'] },
    { pattern: /^([\s\S]*)\. Adresse, Verbindung und CORS-Freigabe des Zielservers prüfen\.$/, key: '{detail}. Adresse, Verbindung und CORS-Freigabe des Zielservers prüfen.', names: ['detail'] }
];

export function translate(text: string, language: AppLanguage, parameters: TranslationParameters = {}): string {
    const translated = Object.prototype.hasOwnProperty.call(english, text) ? english[text] : undefined;
    let value: TranslationValue = language === 'en' ? translated ?? text : text;
    if (language === 'en' && value === text) {
        for (const diagnostic of diagnostics) {
            const match = text.match(diagnostic.pattern);
            if (match && english[diagnostic.key] !== undefined) return translate(diagnostic.key, language,
                Object.fromEntries(diagnostic.names.map((name, index) => [name, match[index + 1]])));
        }
    }
    if (typeof value !== 'string') value = parameters.count === 1 ? value.one : value.other;
    return value.replace(/\{(\w+)\}/g, (placeholder, name: string) => Object.prototype.hasOwnProperty.call(parameters, name) ? String(parameters[name]) : placeholder);
}

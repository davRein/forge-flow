import type { AppLanguage } from '../../types/settings.types';
import { settingsEnglish } from '../../config/settingsTranslations.js';
import { wikiEnglish } from '../../config/wikiTranslations.js';
import { toolsEnglish } from '../../config/toolsTranslations.js';
import { commonEnglish } from '../../config/commonTranslations.js';
import { chatEnglish } from '../../config/chatTranslations.js';
import { timeEnglish } from '../../config/timeTranslations.js';
import { businessEnglish } from '../../config/businessTranslations.js';
import { developerEnglish } from '../../config/developerTranslations.js';
import { consistencyEnglish, consistencyGerman } from '../../config/consistencyTranslations.js';
import { french } from '../../config/frenchTranslations.js';

export type TranslationValue = string | { one: string; other: string };
export type TranslationParameters = Readonly<Record<string, string | number>>;
const english: Readonly<Record<string, TranslationValue>> = { ...settingsEnglish, ...commonEnglish, ...wikiEnglish, ...toolsEnglish, ...chatEnglish, ...timeEnglish, ...businessEnglish, ...developerEnglish, ...consistencyEnglish };

// These patterns only describe application-generated diagnostics, not user content.
const diagnostics: { pattern: RegExp; key: string; names: string[] }[] = [
    { pattern: /^(\d+) Datei hinzugefügt\.$/, key: '{count} Datei hinzugefügt.', names: ['count'] },
    { pattern: /^(\d+) Dateien hinzugefügt\.$/, key: '{count} Dateien hinzugefügt.', names: ['count'] },
    ...['erstellt', 'aktualisiert', 'gelöscht', 'verschoben'].map(verb => ({ pattern: new RegExp(`^([A-Z][A-Z0-9]*-\\d+) wurde ${verb}$`), key: `{code} wurde ${verb}`, names: ['code'] })),
    ...['erstellt', 'aktualisiert', 'gelöscht'].map(verb => ({ pattern: new RegExp(`^Epic „([\\s\\S]*)“ wurde ${verb}$`), key: `Epic „{name}“ wurde ${verb}`, names: ['name'] })),
    ...['erstellt', 'aktualisiert', 'gelöscht', 'gestartet', 'abgeschlossen'].map(verb => ({ pattern: new RegExp(`^Sprint „([\\s\\S]*)“ wurde ${verb}$`), key: `Sprint „{name}“ wurde ${verb}`, names: ['name'] })),
    ...['hinzugefügt', 'entfernt'].map(verb => ({ pattern: new RegExp(`^Datei „([\\s\\S]*)“ wurde ${verb}$`), key: `Datei „{name}“ wurde ${verb}`, names: ['name'] })),
    { pattern: /^Datei „([\s\S]*)“ wurde in „([\s\S]*)“ umbenannt$/, key: 'Datei „{name}“ wurde in „{newName}“ umbenannt', names: ['name', 'newName'] },
    { pattern: /^Ungültiges JSON: ([\s\S]*)$/, key: 'Ungültiges JSON: {detail}', names: ['detail'] },
    { pattern: /^Zahl oder Klammer an Position (\d+) erwartet\.$/, key: 'Zahl oder Klammer an Position {position} erwartet.', names: ['position'] },
    { pattern: /^Unerwartetes Zeichen an Position (\d+)\.$/, key: 'Unerwartetes Zeichen an Position {position}.', names: ['position'] },
    { pattern: /^Die Ziffer „([0-9a-f])“ ist in Basis (\d+) nicht erlaubt\.$/i, key: 'Die Ziffer „{digit}“ ist in Basis {base} nicht erlaubt.', names: ['digit', 'base'] },
    { pattern: /^Zeitlimit von (\d+) Sekunden erreicht\.$/, key: 'Zeitlimit von {seconds} Sekunden erreicht.', names: ['seconds'] },
    { pattern: /^([\s\S]*)\. Adresse, Verbindung und CORS-Freigabe des Zielservers prüfen\.$/, key: '{detail}. Adresse, Verbindung und CORS-Freigabe des Zielservers prüfen.', names: ['detail'] }
];

export function translate(text: string, language: AppLanguage, parameters: TranslationParameters = {}): string {
    const key = text.replace(/\s+/g, ' ').trim();
    const dictionary = language === 'fr' ? french : english;
    const translated = Object.prototype.hasOwnProperty.call(dictionary, key) ? dictionary[key] : undefined;
    let value: TranslationValue = language !== 'de' ? translated ?? text : Object.prototype.hasOwnProperty.call(consistencyGerman, key) ? consistencyGerman[key] : text;
    if (language !== 'de' && value === text) {
        for (const diagnostic of diagnostics) {
            const match = text.match(diagnostic.pattern);
            if (match && dictionary[diagnostic.key] !== undefined) return translate(diagnostic.key, language,
                Object.fromEntries(diagnostic.names.map((name, index) => [name, match[index + 1]])));
        }
    }
    if (typeof value !== 'string') {
        const singular = language === 'fr' && typeof parameters.count === 'number'
            ? new Intl.PluralRules('fr').select(parameters.count) === 'one' : parameters.count === 1;
        value = singular ? value.one : value.other;
    }
    if (value !== text && text.trim() !== text) value = (text.match(/^\s*/)?.[0] ?? '') + value + (text.match(/\s*$/)?.[0] ?? '');
    return value.replace(/\{(\w+)\}/g, (placeholder, name: string) => Object.prototype.hasOwnProperty.call(parameters, name) ? String(parameters[name]) : placeholder);
}

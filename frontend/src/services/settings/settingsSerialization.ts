import { defaultSettings } from '../../config/appSettings.js';
import type { AppLanguage, AppSettings, ThemeMode } from '../../types/settings.types';
import type { StoredSettings } from './settingsRepository';
import { themeModes } from '../../types/settings.types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function normalizeSettings(value: unknown, defaultLanguage: AppLanguage = defaultSettings.language): AppSettings {
    const input = isRecord(value) ? value : {};
    return {
        themeMode: themeModes.includes(input.themeMode as ThemeMode) ? input.themeMode as ThemeMode : defaultSettings.themeMode,
        defaultProjectView: input.defaultProjectView === 'projects' || input.defaultProjectView === 'dashboard'
            ? input.defaultProjectView : defaultSettings.defaultProjectView,
        defaultTaskPriority: input.defaultTaskPriority === 'low' || input.defaultTaskPriority === 'medium' || input.defaultTaskPriority === 'high'
            ? input.defaultTaskPriority : defaultSettings.defaultTaskPriority,
        language: input.language === 'en' || input.language === 'de' ? input.language : defaultLanguage
    };
}

export function decodeSettings(record: unknown, defaultLanguage: AppLanguage = defaultSettings.language): AppSettings {
    if (record === null) return { ...defaultSettings, language: defaultLanguage };
    if (!isRecord(record) || record.version !== 1 || !isRecord(record.settings)) {
        throw new Error('Unsupported or invalid settings record');
    }
    return normalizeSettings(record.settings, defaultLanguage);
}

export function encodeSettings(settings: AppSettings): StoredSettings {
    return { version: 1, settings: normalizeSettings(settings) };
}

import { defaultSettings } from '../../config/appSettings.js';
import type { AppSettings } from '../../types/settings.types';
import type { StoredSettings } from './settingsRepository';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function normalizeSettings(value: unknown): AppSettings {
    const input = isRecord(value) ? value : {};
    return {
        themeMode: input.themeMode === 'light' || input.themeMode === 'dark' ? input.themeMode : defaultSettings.themeMode,
        defaultProjectView: input.defaultProjectView === 'projects' || input.defaultProjectView === 'dashboard'
            ? input.defaultProjectView : defaultSettings.defaultProjectView,
        defaultTaskPriority: input.defaultTaskPriority === 'low' || input.defaultTaskPriority === 'medium' || input.defaultTaskPriority === 'high'
            ? input.defaultTaskPriority : defaultSettings.defaultTaskPriority
    };
}

export function decodeSettings(record: unknown): AppSettings {
    if (record === null) return { ...defaultSettings };
    if (!isRecord(record) || record.version !== 1 || !isRecord(record.settings)) {
        throw new Error('Unsupported or invalid settings record');
    }
    return normalizeSettings(record.settings);
}

export function encodeSettings(settings: AppSettings): StoredSettings {
    return { version: 1, settings: normalizeSettings(settings) };
}

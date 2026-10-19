import type { SettingsRepository, StoredSettings } from './settingsRepository';

export function createSessionSettingsRepository(): SettingsRepository {
    const records = new Map<string | null, StoredSettings>();
    return {
        persistence: 'session',
        async load(userId) {
            const record = records.get(userId);
            return record ? { version: record.version, settings: { ...record.settings } } : null;
        },
        async save(userId, record) {
            records.set(userId, { version: record.version, settings: { ...record.settings } });
        }
    };
}

export const sessionSettingsRepository = createSessionSettingsRepository();

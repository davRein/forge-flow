import type { AppSettings } from '../../types/settings.types';

export type StoredSettings = {
    version: 1;
    settings: AppSettings;
};

export type SettingsRepository = {
    readonly persistence: 'session' | 'account';
    // null represents the current anonymous session, never a signed-in user.
    load(userId: string | null): Promise<unknown>;
    save(userId: string | null, record: StoredSettings): Promise<void>;
};

export type SettingsStatus = 'loading' | 'ready' | 'saving' | 'error';
export type SettingsError = { operation: 'load' | 'save'; message: string };

export type SettingsSnapshot = {
    settings: AppSettings;
    status: SettingsStatus;
    error: SettingsError | null;
};

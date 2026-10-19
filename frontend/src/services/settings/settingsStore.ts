import { defaultSettings } from '../../config/appSettings.js';
import type { AppSettings } from '../../types/settings.types';
import type { SettingsRepository, SettingsSnapshot } from './settingsRepository';
import { decodeSettings, encodeSettings, normalizeSettings } from './settingsSerialization.js';

export function createSettingsStore(repository: SettingsRepository, userId: string | null) {
    let snapshot: SettingsSnapshot = { settings: { ...defaultSettings }, status: 'loading', error: null };
    const listeners = new Set<() => void>();
    let loadRevision = 0;
    let writeRevision = 0;
    let saveQueue = Promise.resolve();

    function publish(next: SettingsSnapshot) {
        snapshot = next;
        listeners.forEach((listener) => listener());
    }

    async function load() {
        const revision = ++loadRevision;
        const writesAtStart = writeRevision;
        publish({ ...snapshot, status: 'loading', error: null });
        try {
            const stored = await repository.load(userId);
            if (revision !== loadRevision || writesAtStart !== writeRevision) return;
            publish({ settings: decodeSettings(stored), status: 'ready', error: null });
        } catch {
            if (revision !== loadRevision || writesAtStart !== writeRevision) return;
            publish({ ...snapshot, status: 'error', error: {
                operation: 'load', message: 'Die Einstellungen konnten nicht geladen werden. Bitte erneut versuchen.'
            } });
        }
    }

    function updateSettings(next: AppSettings) {
        if (snapshot.status === 'loading' || snapshot.error?.operation === 'load') return;
        const settings = normalizeSettings(next);
        const revision = ++writeRevision;
        publish({ settings, status: 'saving', error: null });
        const record = encodeSettings(settings);
        // Each accepted edit is saved in order for this user, including resets.
        saveQueue = saveQueue.then(async () => {
            try {
                await repository.save(userId, record);
                if (revision === writeRevision) publish({ ...snapshot, status: 'ready', error: null });
            } catch {
                if (revision === writeRevision) publish({ ...snapshot, status: 'error', error: {
                    operation: 'save', message: 'Die Änderungen sind aktiv, konnten aber nicht gespeichert werden. Bitte erneut versuchen.'
                } });
            }
        });
    }

    function resetSettings() {
        updateSettings({ ...defaultSettings });
    }

    function retry() {
        if (snapshot.error?.operation === 'load') void load();
        else if (snapshot.error?.operation === 'save') updateSettings(snapshot.settings);
    }

    return {
        getSnapshot: () => snapshot,
        subscribe(listener: () => void) {
            listeners.add(listener);
            return () => { listeners.delete(listener); };
        },
        load,
        cancelPendingLoad() { loadRevision++; },
        updateSettings,
        resetSettings,
        retry,
        // A future sign-out flow can await pending writes before ending the session.
        whenIdle: () => saveQueue
    };
}

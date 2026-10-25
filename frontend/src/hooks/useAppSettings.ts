import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { SettingsRepository } from '../services/settings/settingsRepository';
import { sessionSettingsRepository } from '../services/settings/sessionSettingsRepository';
import { createSettingsStore } from '../services/settings/settingsStore';
import { getBrowserLanguage, rememberBrowserLanguage } from '../services/i18n/browserLanguage';

type Options = { userId?: string | null; repository?: SettingsRepository };

export function useAppSettings({ userId = null, repository = sessionSettingsRepository }: Options = {}) {
    const store = useMemo(() => createSettingsStore(repository, userId, getBrowserLanguage()), [repository, userId]);
    const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

    useEffect(() => {
        void store.load();
        return () => store.cancelPendingLoad();
    }, [store]);

    useEffect(() => {
        if (snapshot.status !== 'loading' && snapshot.error?.operation !== 'load') {
            rememberBrowserLanguage(snapshot.settings.language);
        }
    }, [snapshot.status, snapshot.error?.operation, snapshot.settings.language]);

    return {
        ...snapshot,
        persistence: repository.persistence,
        updateSettings: store.updateSettings,
        resetSettings: store.resetSettings,
        retry: store.retry,
        discardUnsaved: store.discardUnsaved
    };
}

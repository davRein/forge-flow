import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { SettingsRepository } from '../services/settings/settingsRepository';
import { sessionSettingsRepository } from '../services/settings/sessionSettingsRepository';
import { createSettingsStore } from '../services/settings/settingsStore';

type Options = { userId?: string | null; repository?: SettingsRepository };

export function useAppSettings({ userId = null, repository = sessionSettingsRepository }: Options = {}) {
    const store = useMemo(() => createSettingsStore(repository, userId), [repository, userId]);
    const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

    useEffect(() => {
        void store.load();
        return () => store.cancelPendingLoad();
    }, [store]);

    return {
        ...snapshot,
        persistence: repository.persistence,
        updateSettings: store.updateSettings,
        resetSettings: store.resetSettings,
        retry: store.retry
    };
}

import { useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { GlobalSettingsContext } from '../hooks/globalSettingsContext';
import { createGlobalSettingsStore } from '../services/settings/globalSettings';
import type { GlobalSettingsRepository } from '../services/settings/globalSettings';

export default function GlobalSettingsProvider({ repository, children }: { repository: GlobalSettingsRepository; children: ReactNode }) {
    const store = useMemo(() => createGlobalSettingsStore(repository), [repository]);
    useEffect(() => { store.connect(); void store.load(); return () => store.dispose(); }, [store]);
    return <GlobalSettingsContext.Provider value={store}>{children}</GlobalSettingsContext.Provider>;
}

import { useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { RestCollectionsContext } from '../hooks/restCollectionsContext';
import { createRestCollectionsStore } from '../services/rest/restCollections';
import type { RestCollectionsRepository } from '../services/rest/restCollections';

export default function RestCollectionsProvider({ repository, children, enabled = true }: { enabled?: boolean; repository: RestCollectionsRepository; children: ReactNode }) {
    const store = useMemo(() => createRestCollectionsStore(repository), [repository]);
    useEffect(() => { if (enabled) store.connect(); return () => store.dispose(); }, [store, enabled]);
    return <RestCollectionsContext.Provider value={store}>{children}</RestCollectionsContext.Provider>;
}

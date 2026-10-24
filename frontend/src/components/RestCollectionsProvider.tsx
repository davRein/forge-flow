import { useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { RestCollectionsContext } from '../hooks/restCollectionsContext';
import { createRestCollectionsStore } from '../services/rest/restCollections';
import type { RestCollectionsRepository } from '../services/rest/restCollections';

export default function RestCollectionsProvider({ repository, children }: { repository: RestCollectionsRepository; children: ReactNode }) {
    const store = useMemo(() => createRestCollectionsStore(repository), [repository]);
    useEffect(() => { store.connect(); return () => store.dispose(); }, [store]);
    return <RestCollectionsContext.Provider value={store}>{children}</RestCollectionsContext.Provider>;
}

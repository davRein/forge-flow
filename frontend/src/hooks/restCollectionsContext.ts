import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import { createRestCollectionsStore, createSessionRestCollectionsRepository } from '../services/rest/restCollections';
import type { RestCollectionsStore } from '../services/rest/restCollections';

export const RestCollectionsContext = createContext<RestCollectionsStore | null>(null);
export function useRestCollections() {
    const provided = useContext(RestCollectionsContext);
    const store = useMemo(() => provided ?? createRestCollectionsStore(createSessionRestCollectionsRepository()), [provided]);
    useEffect(() => { if (!provided) { store.connect(); return () => store.dispose(); } }, [provided, store]);
    return { store, ...useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot) };
}

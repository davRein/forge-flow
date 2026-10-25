import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import { createBusinessStore, createSessionBusinessRepository } from '../services/business/business';
import type { BusinessStore } from '../services/business/business';
export const BusinessContext = createContext<BusinessStore | null>(null);
export function useBusiness(active = true) {
    const provided = useContext(BusinessContext);
    const store = useMemo(() => provided ?? createBusinessStore(createSessionBusinessRepository()), [provided]);
    useEffect(() => { if (!provided) { store.connect(); return () => store.dispose(); } }, [provided, store]);
    const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
    useEffect(() => { if (active && state.status === 'idle') void store.load(); }, [active, state.status, store]);
    return { store, ...state };
}

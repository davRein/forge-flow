import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import { createTimeTrackingStore, createSessionTimeTrackingRepository } from '../services/time/timeTracking';
import type { TimeTrackingStore } from '../services/time/timeTracking';

export const TimeTrackingContext = createContext<TimeTrackingStore | null>(null);
export function useTimeTracking() {
    const provided = useContext(TimeTrackingContext);
    const store = useMemo(() => provided ?? createTimeTrackingStore(createSessionTimeTrackingRepository()), [provided]);
    useEffect(() => { if (!provided) { store.connect(); return () => store.dispose(); } }, [provided, store]);
    return { store, ...useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot) };
}

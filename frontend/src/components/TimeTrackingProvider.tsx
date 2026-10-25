import { useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { TimeTrackingContext } from '../hooks/timeTrackingContext';
import { createTimeTrackingStore } from '../services/time/timeTracking';
import type { TimeTrackingRepository } from '../services/time/timeTracking';

export default function TimeTrackingProvider({ repository, children }: { repository: TimeTrackingRepository; children: ReactNode }) {
    const store = useMemo(() => createTimeTrackingStore(repository), [repository]);
    useEffect(() => { store.connect(); return () => store.dispose(); }, [store]);
    return <TimeTrackingContext.Provider value={store}>{children}</TimeTrackingContext.Provider>;
}

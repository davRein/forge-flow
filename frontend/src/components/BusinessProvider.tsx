import { useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { BusinessContext } from '../hooks/businessContext';
import { createBusinessStore } from '../services/business/business';
import type { BusinessRepository } from '../services/business/business';
export default function BusinessProvider({ repository, children, enabled = true }: { enabled?: boolean; repository: BusinessRepository; children: ReactNode }) {
    const store = useMemo(() => createBusinessStore(repository), [repository]);
    useEffect(() => { if (enabled) store.connect(); return () => store.dispose(); }, [store, enabled]);
    return <BusinessContext.Provider value={store}>{children}</BusinessContext.Provider>;
}

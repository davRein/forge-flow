import { useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { BusinessContext } from '../hooks/businessContext';
import { createBusinessStore } from '../services/business/business';
import type { BusinessRepository } from '../services/business/business';
export default function BusinessProvider({ repository, children }: { repository: BusinessRepository; children: ReactNode }) {
    const store = useMemo(() => createBusinessStore(repository), [repository]);
    useEffect(() => { store.connect(); return () => store.dispose(); }, [store]);
    return <BusinessContext.Provider value={store}>{children}</BusinessContext.Provider>;
}

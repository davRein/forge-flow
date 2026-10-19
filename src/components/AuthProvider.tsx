import { useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { AuthContext } from '../hooks/authContext';
import { createAuthStore } from '../services/auth/authStore';
import { apiClient, apiEnabled } from '../services/api/runtime';

export default function AuthProvider({ children }: { children: ReactNode }) {
    const store = useMemo(() => createAuthStore(apiClient, apiEnabled), []);
    useEffect(() => {
        store.connect(); void store.refresh();
        const refresh = () => { void store.refresh(); };
        window.addEventListener('focus', refresh);
        return () => { window.removeEventListener('focus', refresh); store.dispose(); };
    }, [store]);
    return <AuthContext.Provider value={store}>{children}</AuthContext.Provider>;
}

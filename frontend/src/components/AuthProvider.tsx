import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { AuthContext } from '../hooks/authContext';
import { createAuthStore } from '../services/auth/authStore';
import { apiClient, apiEnabled } from '../services/api/runtime';

export default function AuthProvider({ children }: { children: ReactNode }) {
    const store = useMemo(() => createAuthStore(apiClient, apiEnabled), []);
    const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
    useEffect(() => {
        if (!state.user?.expiresAt) return;
        const timer = window.setTimeout(() => void store.refresh(), Math.max(0, Date.parse(state.user.expiresAt) - Date.now() + 100));
        return () => window.clearTimeout(timer);
    }, [store, state.user?.expiresAt]);
    useEffect(() => {
        store.connect(); void store.refresh();
        const refresh = () => { void store.refresh(); };
        window.addEventListener('focus', refresh);
        return () => { window.removeEventListener('focus', refresh); store.dispose(); };
    }, [store]);
    return <AuthContext.Provider value={store}>{children}</AuthContext.Provider>;
}

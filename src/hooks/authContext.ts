import { createContext, useContext, useSyncExternalStore } from 'react';
import type { AuthStore } from '../services/auth/authStore';

export const AuthContext = createContext<AuthStore | null>(null);
export function useAuth() {
    const store = useContext(AuthContext);
    if (!store) throw new Error('AuthProvider fehlt.');
    return { ...useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot), login: store.login, logout: store.logout, refresh: store.refresh };
}

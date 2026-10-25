import { createContext, useContext, useId, useLayoutEffect, useRef } from 'react';
import { useChatNavigationBlocker } from './chatNavigationContext';

export type NavigationDraft = { pending: boolean; discard: () => void };
export const NavigationGuard = createContext<{
    request: (action: () => void) => void;
    register: (id: string, draft: NavigationDraft | null) => void;
}>({ request: action => action(), register() {} });
export const useNavigationGuard = () => useContext(NavigationGuard);

export function useUnsavedChanges(dirty: boolean, discard: () => void, pending = false) {
    const { register } = useNavigationGuard();
    const id = useId(); const latest = useRef(discard); latest.current = discard;
    useChatNavigationBlocker(dirty || pending);
    useLayoutEffect(() => {
        register(id, dirty || pending ? { pending, discard: () => latest.current() } : null);
        return () => register(id, null);
    }, [register, id, dirty, pending]);
}

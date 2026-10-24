import { createContext, useContext, useEffect, useId, useLayoutEffect, useRef } from 'react';
import type { NavigationAction, NavigationExecutor } from '../services/ai/navigationActions';
import { NavigationError } from '../services/ai/navigationActions';

export const ChatNavigation = createContext<{
    available: boolean; blocked: boolean; execute: NavigationExecutor;
    register?: (handler: (action: NavigationAction) => void) => () => void;
    block?: (id: string, blocked: boolean) => void;
}>({ available: false, blocked: false, execute: async () => { throw new NavigationError('NAVIGATION_UNAVAILABLE'); } });
export const useChatNavigation = () => useContext(ChatNavigation);
export function useChatNavigator(handler: (action: NavigationAction) => void) {
    const { register } = useChatNavigation();
    const latest = useRef(handler);
    latest.current = handler;
    useEffect(() => register?.(action => latest.current(action)), [register]);
}
export function useChatNavigationBlocker(blocked: boolean) {
    const { block } = useChatNavigation();
    const id = useId();
    useLayoutEffect(() => {
        block?.(id, blocked);
        return () => block?.(id, false);
    }, [block, id, blocked]);
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ChatNavigation } from '../../hooks/chatNavigationContext';
import { useChatPageContext } from '../../hooks/chatPageContext';
import { isNavigationAction, NavigationError } from '../../services/ai/navigationActions';
import type { NavigationAction } from '../../services/ai/navigationActions';

export default function ChatNavigationProvider({ children }: { children: ReactNode }) {
    const page = useChatPageContext();
    const latestPage = useRef(page);
    latestPage.current = page;
    const handler = useRef<((action: NavigationAction) => void) | null>(null);
    const blockers = useRef(new Set<string>());
    const [available, setAvailable] = useState(false);
    const [blocked, setBlocked] = useState(false);
    const pending = useRef<{ action: NavigationAction; finish: (error?: NavigationError) => void } | null>(null);
    const register = useCallback((navigate: (action: NavigationAction) => void) => {
        handler.current = navigate; setAvailable(true);
        return () => { if (handler.current === navigate) { handler.current = null; setAvailable(false); pending.current?.finish(new NavigationError('NAVIGATION_UNAVAILABLE')); } };
    }, []);
    const block = useCallback((id: string, active: boolean) => {
        if (active) blockers.current.add(id); else blockers.current.delete(id);
        setBlocked(blockers.current.size > 0);
    }, []);
    const execute = useCallback((action: NavigationAction, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
        if (!isNavigationAction(action) || action.status !== 'approved' || !handler.current || pending.current) return reject(new NavigationError('NAVIGATION_UNAVAILABLE'));
        if (signal.aborted) return reject(new NavigationError('CLIENT_CANCELLED'));
        if (Date.parse(action.expiresAt) <= Date.now()) return reject(new NavigationError('EXPIRED'));
        if (blockers.current.size) return reject(new NavigationError('UNSAVED_CHANGES'));
        const run = { action, finish: (error?: NavigationError) => {
            if (pending.current !== run) return;
            clearTimeout(timer); signal.removeEventListener('abort', abort); pending.current = null;
            if (error) reject(error); else resolve();
        } };
        const abort = () => run.finish(new NavigationError('CLIENT_CANCELLED'));
        const timer = setTimeout(() => run.finish(new NavigationError('NAVIGATION_UNAVAILABLE')), 3000);
        pending.current = run; signal.addEventListener('abort', abort, { once: true });
        try {
            handler.current(action);
            const current = latestPage.current;
            if (current?.route === '/projectManager/projects' && current.projectId === action.projectId && current.projectTab === action.projectTab) run.finish();
        } catch (error) { run.finish(error instanceof NavigationError ? error : new NavigationError('NAVIGATION_UNAVAILABLE')); }
    }), []);
    useEffect(() => {
        const run = pending.current;
        if (run && page?.route === '/projectManager/projects' && page.projectId === run.action.projectId && page.projectTab === run.action.projectTab) run.finish();
    }, [page]);
    useEffect(() => () => pending.current?.finish(new NavigationError('CLIENT_CANCELLED')), []);
    const value = useMemo(() => ({ available, blocked, execute, register, block }), [available, blocked, execute, register, block]);
    return <ChatNavigation.Provider value={value}>{children}</ChatNavigation.Provider>;
}

import { createContext, useContext, useEffect } from 'react';
import type { DeveloperView, Snippet } from '../services/developer/developer';
export type DeveloperContextValue = { data: DeveloperView; status: 'idle' | 'loading' | 'ready' | 'error'; error: string; busy: boolean; remote: boolean;
    load: () => Promise<void>; request: <T>(path: string, body?: unknown, method?: string, revision?: boolean) => Promise<T>;
    saveSnippet: (value: Omit<Snippet, 'id' | 'updatedAt'> & { id?: string }) => Promise<Snippet>; deleteSnippet: (id: string) => Promise<void> };
export const DeveloperContext = createContext<DeveloperContextValue | null>(null);
export function useDeveloper(active = false) {
    const context = useContext(DeveloperContext);
    if (!context) throw new Error('DeveloperProvider fehlt.');
    const { status, load } = context;
    useEffect(() => { if (active && status === 'idle') void load(); }, [active, status, load]);
    return context;
}

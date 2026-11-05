import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { apiClient, apiEnabled } from '../services/api/runtime';
import { createDeveloperRepository, decodeDeveloper, emptyDeveloper, type DeveloperView, type Snippet } from '../services/developer/developer';
import { DeveloperContext, type DeveloperContextValue } from '../hooks/developerContext';

const repository = createDeveloperRepository(apiClient);

export default function DeveloperProvider({ children }: { children: ReactNode }) {
    const [data, setData] = useState(emptyDeveloper); const dataRef = useRef(data);
    const [status, setStatus] = useState<DeveloperContextValue['status']>(apiEnabled ? 'idle' : 'ready');
    const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
    const locked = useRef(false); const alive = useRef(true);
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    const accept = useCallback((value: DeveloperView) => { if (alive.current) { dataRef.current = value; setData(value); } }, []);
    const load = useCallback(async () => {
        if (!apiEnabled || locked.current) return;
        locked.current = true; setBusy(true); setStatus('loading'); setError('');
        try { accept(await repository.load()); if (alive.current) setStatus('ready'); }
        catch (failure) { if (alive.current) { setStatus('error'); setError(failure instanceof Error ? failure.message : 'Anfrage fehlgeschlagen.'); } }
        finally { locked.current = false; if (alive.current) setBusy(false); }
    }, [accept]);
    const request = useCallback(async <T,>(path: string, body?: unknown, method = 'POST', revision = false): Promise<T> => {
        if (!apiEnabled) throw new Error('Diese Funktion benötigt eine Backend-Verbindung.');
        if (locked.current) throw new Error('Bitte die laufende Anfrage abwarten.');
        locked.current = true; setBusy(true); setError('');
        try {
            const result = await repository.request<T>(path, body, method, revision ? dataRef.current.revision : undefined);
            if (result && typeof result === 'object') {
                if ('revision' in result) accept(decodeDeveloper(result));
                else if ('data' in result) accept(decodeDeveloper(result.data));
            }
            return result;
        } catch (failure) { if (alive.current) setError(failure instanceof Error ? failure.message : 'Anfrage fehlgeschlagen.'); throw failure; }
        finally { locked.current = false; if (alive.current) setBusy(false); }
    }, [accept]);
    const saveSnippet = useCallback(async (value: Omit<Snippet, 'id' | 'updatedAt'> & { id?: string }) => {
        if (apiEnabled) {
            const ids = new Set(dataRef.current.snippets.map(item => item.id));
            const result = await request<DeveloperView>('/snippets', { ...value, id: value.id ?? null }, 'POST', true);
            const saved = result.snippets.find(item => value.id ? item.id === value.id : !ids.has(item.id));
            if (!saved) throw new Error('Ungültige Entwicklerdaten.');
            return saved;
        }
        const next = { ...value, id: value.id ?? crypto.randomUUID(), updatedAt: new Date().toISOString() };
        accept({ ...dataRef.current, snippets: [...dataRef.current.snippets.filter(item => item.id !== next.id), next] });
        return next;
    }, [accept, request]);
    const deleteSnippet = useCallback(async (id: string) => {
        if (apiEnabled) { await request(`/snippets/${id}`, undefined, 'DELETE', true); return; }
        accept({ ...dataRef.current, snippets: dataRef.current.snippets.filter(item => item.id !== id) });
    }, [accept, request]);
    return <DeveloperContext.Provider value={{ data, status, error, busy, remote: apiEnabled, load, request, saveSnippet, deleteSnippet }}>{children}</DeveloperContext.Provider>;
}

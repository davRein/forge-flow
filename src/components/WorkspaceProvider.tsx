import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { WorkspaceContext, useWorkspacePersistence } from '../hooks/workspaceContext';
import { createWorkspaceStore } from '../services/workspace/workspaceStore';
import type { WorkspaceRepository } from '../services/workspace/workspaceTypes';
import { ErrorText, FormCard, SecondaryButton } from './ui/formStyles';

export default function WorkspaceProvider({ repository, children }: { repository: WorkspaceRepository; children: ReactNode }) {
    const store = useMemo(() => createWorkspaceStore(repository), [repository]);
    const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
    useEffect(() => { void store.load(); return () => store.dispose(); }, [store]);
    useEffect(() => {
        const prevent = (event: BeforeUnloadEvent) => { if (state.status === 'saving' || (state.error && state.data)) event.preventDefault(); };
        window.addEventListener('beforeunload', prevent);
        return () => window.removeEventListener('beforeunload', prevent);
    }, [state.status, state.error, state.data]);
    if (!state.data) return <FormCard style={{ margin: 24 }}><p role="status">{state.status === 'loading' ? 'Daten werden geladen …' : 'Daten sind nicht verfügbar.'}</p>
        {state.error && <><ErrorText role="alert">{state.error}</ErrorText><SecondaryButton onClick={() => void store.load()}>Erneut laden</SecondaryButton></>}
    </FormCard>;
    return <WorkspaceContext.Provider value={store}>{children}</WorkspaceContext.Provider>;
}

export function WorkspaceStatus() {
    const store = useWorkspacePersistence();
    const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
    const [confirmReload, setConfirmReload] = useState(false);
    return store.persistence === 'account' ? <FormCard style={{ margin: '16px 24px' }}>
            <p role="status">{state.status === 'saving' ? 'Änderungen werden gespeichert …' : state.status === 'ready' ? 'Daten mit dem Backend synchronisiert.' : ''}</p>
            {state.error && <><ErrorText role="alert">{state.error} Deine Änderungen bleiben bis zum Neuladen in dieser Ansicht erhalten.</ErrorText>
                {!state.conflict && <SecondaryButton onClick={store.retry}>Speichern wiederholen</SecondaryButton>}{' '}
                <SecondaryButton onClick={() => setConfirmReload(true)}>Serverstand laden</SecondaryButton>
                {confirmReload && <><p>Ungespeicherte Änderungen und offene Entwürfe verwerfen und den Serverstand laden?</p>
                    <SecondaryButton onClick={() => { setConfirmReload(false); void store.load(); }}>Verwerfen und laden</SecondaryButton>{' '}
                    <SecondaryButton onClick={() => setConfirmReload(false)}>Abbrechen</SecondaryButton></>}
            </>}
        </FormCard> : null;
}

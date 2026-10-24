import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { WorkspaceContext } from '../hooks/workspaceContext';
import { createWorkspaceStore } from '../services/workspace/workspaceStore';
import type { WorkspaceRepository } from '../services/workspace/workspaceTypes';
import { ErrorText, FormCard, SecondaryButton } from './ui/formStyles';
import { useTranslation } from '../hooks/languageContext';

export default function WorkspaceProvider({ repository, children }: { repository: WorkspaceRepository; children: ReactNode }) {
    const { t, language } = useTranslation();
    const store = useMemo(() => createWorkspaceStore(repository), [repository]);
    const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
    useEffect(() => { void store.load(); return () => store.dispose(); }, [store]);
    useEffect(() => {
        const prevent = (event: BeforeUnloadEvent) => { if (state.status === 'saving' || (state.error && state.data)) event.preventDefault(); };
        window.addEventListener('beforeunload', prevent);
        return () => window.removeEventListener('beforeunload', prevent);
    }, [state.status, state.error, state.data]);
    if (!state.data) return <FormCard lang={language} style={{ margin: 24 }}><p role="status">{t(state.status === 'loading' ? 'Daten werden geladen …' : 'Daten sind nicht verfügbar.')}</p>
        {state.error && <><ErrorText role="alert">{t(state.error)}</ErrorText><SecondaryButton onClick={() => void store.load()}>{t('Erneut laden')}</SecondaryButton></>}
    </FormCard>;
    return <WorkspaceContext.Provider value={store}>{children}</WorkspaceContext.Provider>;
}

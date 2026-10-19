import { createContext, useContext, useSyncExternalStore } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { WorkspaceStore } from '../services/workspace/workspaceStore';
import type { Workspace } from '../services/workspace/workspaceTypes';

export const WorkspaceContext = createContext<WorkspaceStore | null>(null);
export function useWorkspaceField<K extends keyof Workspace>(key: K): [Workspace[K], Dispatch<SetStateAction<Workspace[K]>>] {
    const store = useContext(WorkspaceContext);
    if (!store) throw new Error('WorkspaceProvider fehlt.');
    const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
    if (!state.data) throw new Error('Workspace ist noch nicht geladen.');
    return [state.data[key], (action) => store.update(key, action)];
}
export function useWorkspacePersistence() {
    const store = useContext(WorkspaceContext);
    if (!store) throw new Error('WorkspaceProvider fehlt.');
    return store;
}

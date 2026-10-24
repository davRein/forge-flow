import type { Workspace, WorkspaceRepository } from './workspaceTypes';

type SaveNotice = { id: number; kind: 'success' | 'error' };
type State = { data: Workspace | null; status: 'loading' | 'ready' | 'saving' | 'error'; error: string | null; conflict: boolean; saveNotice: SaveNotice | null };
export function createWorkspaceStore(repository: WorkspaceRepository) {
    let state: State = { data: null, status: 'loading', error: null, conflict: false, saveNotice: null };
    let noticeId = 0;
    let revision = '';
    let changed = 0;
    let saved = 0;
    let saving = false;
    let scheduled = false;
    let generation = 0;
    let controller = new AbortController();
    const listeners = new Set<() => void>();
    const emit = (update: Partial<State>) => { state = { ...state, ...update }; listeners.forEach((listener) => listener()); };
    async function flush() {
        if (saving || !state.data || state.error || saved === changed) return;
        saving = true;
        const run = generation;
        const target = changed;
        const data = state.data;
        emit({ status: 'saving' });
        try {
            const nextRevision = await repository.save(data, revision, controller.signal);
            if (run !== generation) return;
            revision = nextRevision; saved = target;
            // A load or an intermediate write must never announce that all edits were saved.
            emit({ status: saved === changed ? 'ready' : 'saving',
                saveNotice: saved === changed ? { id: ++noticeId, kind: 'success' } : null });
        } catch (error) {
            if (run !== generation) return;
            const conflict = typeof error === 'object' && error !== null && 'status' in error && error.status === 409;
            emit({ status: 'error', conflict, saveNotice: { id: ++noticeId, kind: 'error' }, error: conflict ? 'Die Daten wurden in einer anderen Sitzung geändert. Lade den Serverstand, bevor du weiter speicherst.'
                : error instanceof Error ? error.message : 'Änderungen konnten nicht gespeichert werden.' });
        } finally {
            if (run === generation) { saving = false; if (!state.error && changed !== saved) void flush(); }
        }
    }
    return {
        persistence: repository.persistence,
        getSnapshot: () => state,
        subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
        async load() {
            generation++; const run = generation;
            controller.abort(); controller = new AbortController(); saving = false;
            emit({ status: 'loading', data: null, error: null, conflict: false, saveNotice: null });
            try {
                const result = await repository.load(controller.signal);
                if (run !== generation) return;
                revision = result.revision; changed = 0; saved = 0;
                emit({ data: result.data, status: 'ready' });
            } catch (error) { if (run === generation) emit({ status: 'error', error: error instanceof Error ? error.message : 'Daten konnten nicht geladen werden.' }); }
        },
        update<K extends keyof Workspace>(key: K, action: Workspace[K] | ((current: Workspace[K]) => Workspace[K])) {
            if (!state.data) throw new Error('Die Daten sind noch nicht geladen.');
            const value = typeof action === 'function' ? action(state.data[key]) : action;
            if (value === state.data[key]) return;
            changed++; emit({ data: { ...state.data, [key]: value }, status: state.error ? 'error' : 'saving',
                saveNotice: state.error ? state.saveNotice : null });
            if (!scheduled) { scheduled = true; queueMicrotask(() => { scheduled = false; void flush(); }); }
        },
        async refreshExternal() {
            // Keep mounted forms/chat. Never replace edits made while the read was in flight.
            if (!state.data || state.status !== 'ready' || state.error || saved !== changed || saving) return false;
            const run = generation, before = changed;
            const result = await repository.load(controller.signal);
            if (run !== generation || changed !== before || saved !== changed || saving) return false;
            revision = result.revision; emit({ data: result.data, status: 'ready', error: null, conflict: false }); return true;
        },
        dismissSaveNotice(id: number) {
            if (state.saveNotice?.id === id && state.saveNotice.kind === 'success') emit({ saveNotice: null });
        },
        retry() { if (state.conflict) return; emit({ error: null, status: 'saving', saveNotice: null }); void flush(); },
        dispose() { generation++; controller.abort(); saving = false; }
    };
}
export type WorkspaceStore = ReturnType<typeof createWorkspaceStore>;

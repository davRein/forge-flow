import type { ApiClient } from '../api/apiClient.js';
import { ApiError } from '../api/apiClient.js';

export type TimeEntry = { id: string; date: string; startMinute: number; minutes: number; breakMinutes: number;
    customerId: number | null; projectId: number | null; customerName: string; projectName: string; comment: string; billable: boolean };
export type TimeTracking = { version: 1; revision: string; entries: TimeEntry[] };
export type TimeTrackingRepository = { persistence: 'account' | 'session'; load(signal: AbortSignal): Promise<TimeTracking>; save(value: TimeTracking, signal: AbortSignal): Promise<TimeTracking> };
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const integer = (value: unknown, min: number, max: number): value is number => Number.isSafeInteger(value) && Number(value) >= min && Number(value) <= max;
const text = (value: unknown, max: number): value is string => typeof value === 'string' && value.length <= max;
export function validDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
    const date = new Date(`${value}T12:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function decodeTimeTracking(value: unknown): TimeTracking {
    const invalid = () => new Error('Bitte gültige Zeiteinträge angeben.');
    if (!object(value) || value.version !== 1 || !text(value.revision, 128) || !value.revision.trim() || !Array.isArray(value.entries) || value.entries.length > 10000) throw invalid();
    const ids = new Set<string>();
    const entries = value.entries.map((entry): TimeEntry => {
        if (!object(entry) || typeof entry.id !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(entry.id) || ids.has(entry.id.toLowerCase())
            || typeof entry.date !== 'string' || !validDate(entry.date) || !integer(entry.startMinute, 0, 1439) || !integer(entry.minutes, 1, 1440) || !integer(entry.breakMinutes, 0, 1439)
            || !(entry.customerId === null || integer(entry.customerId, 1, Number.MAX_SAFE_INTEGER)) || !(entry.projectId === null || integer(entry.projectId, 1, Number.MAX_SAFE_INTEGER))
            || entry.customerId === null && entry.projectId !== null || !text(entry.customerName, 1000) || !text(entry.projectName, 1000) || !text(entry.comment, 2000) || typeof entry.billable !== 'boolean') throw invalid();
        ids.add(entry.id.toLowerCase());
        if (entry.startMinute + entry.minutes + entry.breakMinutes > 1440) throw new Error('Ein Zeiteintrag darf nicht über Mitternacht reichen.');
        return { id: entry.id, date: entry.date, startMinute: entry.startMinute, minutes: entry.minutes, breakMinutes: entry.breakMinutes,
            customerId: entry.customerId, projectId: entry.projectId, customerName: entry.customerName, projectName: entry.projectName, comment: entry.comment, billable: entry.billable };
    });
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.startMinute - b.startMinute);
    for (let index = 1; index < sorted.length; index++) {
        const previous = sorted[index - 1], current = sorted[index];
        if (previous.date === current.date && previous.startMinute + previous.minutes + previous.breakMinutes > current.startMinute)
            throw new Error('Zeiteinträge dürfen sich einschließlich Pausen nicht überschneiden.');
    }
    const result: TimeTracking = { version: 1, revision: value.revision, entries };
    if (new TextEncoder().encode(JSON.stringify(result)).length > 5 * 1024 * 1024) throw new Error('Zeiteinträge dürfen insgesamt höchstens 5 MiB umfassen.');
    return result;
}
export function createApiTimeTrackingRepository(client: ApiClient): TimeTrackingRepository {
    const epoch = client.epoch;
    return { persistence: 'account', async load(signal) { return decodeTimeTracking(await client.request('/me/time-tracking', { signal, epoch })); },
        async save(value, signal) { const input = decodeTimeTracking(value); return decodeTimeTracking(await client.request('/me/time-tracking', { method: 'PUT', headers: { 'If-Match': `"${input.revision}"` }, body: input, signal, epoch })); } };
}
export function createSessionTimeTrackingRepository(): TimeTrackingRepository {
    let current: TimeTracking = { version: 1, revision: 'time-initial', entries: [] }; let revision = 0;
    return { persistence: 'session', async load() { return decodeTimeTracking(current); }, async save(value) {
        if (value.revision !== current.revision) throw new Error('Die Zeiteinträge wurden inzwischen geändert. Bitte neu laden.');
        current = decodeTimeTracking({ ...value, revision: `time-session-${++revision}` }); return decodeTimeTracking(current);
    } };
}
type Snapshot = { data: TimeTracking | null; status: 'idle' | 'loading' | 'ready' | 'saving' | 'error'; error: string | null; conflict: boolean };
export function createTimeTrackingStore(repository: TimeTrackingRepository) {
    let state: Snapshot = { data: null, status: 'idle', error: null, conflict: false }; let generation = 0, disposed = false;
    let controller: AbortController | null = null;
    const listeners = new Set<() => void>();
    const publish = (next: Snapshot) => { if (!disposed) { state = next; listeners.forEach(listener => listener()); } };
    const failure = (error: unknown) => error instanceof Error ? error.message : 'Zeiteinträge konnten nicht gespeichert werden.';
    return {
        persistence: repository.persistence,
        getSnapshot: () => state,
        subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
        async load() {
            if (disposed || state.status === 'loading' || state.status === 'saving') return;
            controller?.abort(); const request = new AbortController(); controller = request; const ticket = ++generation;
            publish({ ...state, status: 'loading', error: null });
            try { const data = decodeTimeTracking(await repository.load(request.signal)); if (!disposed && ticket === generation) publish({ data, status: 'ready', error: null, conflict: false }); }
            catch (error) { if (!disposed && ticket === generation) publish({ ...state, status: 'error', error: failure(error) }); }
        },
        async save(entries: TimeEntry[]) {
            if (disposed || state.status !== 'ready' || !state.data || state.conflict) return false;
            const previous = state.data; const request = new AbortController(); controller = request; const ticket = ++generation;
            publish({ ...state, status: 'saving', error: null });
            try { const data = decodeTimeTracking(await repository.save(decodeTimeTracking({ ...previous, entries }), request.signal));
                if (disposed || ticket !== generation) return false; publish({ data, status: 'ready', error: null, conflict: false }); return true;
            } catch (error) { if (!disposed && ticket === generation) publish({ data: previous, status: 'ready', error: failure(error), conflict: error instanceof ApiError && error.code === 'VERSION_CONFLICT' }); return false; }
        },
        connect() { disposed = false; },
        dispose() { disposed = true; generation++; controller?.abort(); state = { data: null, status: 'idle', error: null, conflict: false }; listeners.clear(); }
    };
}
export type TimeTrackingStore = ReturnType<typeof createTimeTrackingStore>;

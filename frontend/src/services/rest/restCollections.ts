import type { ApiClient } from '../api/apiClient.js';
import type { RequestDraft } from '../../pages/devTools/utils/restLogic';

export type SavedRestRequest = { id: string; name: string; draft: RequestDraft };
export type RestCollection = { id: string; name: string; requests: SavedRestRequest[] };
export type RestCollections = { version: 1; revision: string; collections: RestCollection[] };
export type RestCollectionsRepository = { persistence: 'account' | 'session'; load(signal: AbortSignal): Promise<RestCollections>; save(value: RestCollections, signal: AbortSignal): Promise<RestCollections> };
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const invalid = () => new Error('Ungültige Collections oder Anfragen.');
function text(value: unknown, max: number, required = false): string {
    if (typeof value !== 'string' || value.length > max || required && !value.trim()) throw invalid(); return value;
}
export function decodeRestCollections(value: unknown): RestCollections {
    if (!object(value) || value.version !== 1 || !Array.isArray(value.collections) || value.collections.length > 100) throw invalid();
    const ids = new Set<string>(); let requestCount = 0;
    const id = (value: unknown) => { if (typeof value !== 'string' || !uuid.test(value) || ids.has(value.toLowerCase())) throw invalid(); ids.add(value.toLowerCase()); return value; };
    const collections = value.collections.map(collection => {
        if (!object(collection) || !Array.isArray(collection.requests) || collection.requests.length > 1000) throw invalid();
        return { id: id(collection.id), name: text(collection.name, 200, true), requests: collection.requests.map(request => {
            if (!object(request) || !object(request.draft)) throw invalid();
            const raw = request.draft;
            if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(String(raw.method)) || !['none', 'json', 'text'].includes(String(raw.bodyType))
                || typeof raw.timeout !== 'number' || !Number.isInteger(raw.timeout) || raw.timeout < 1 || raw.timeout > 120) throw invalid();
            const url = text(raw.url, 4000);
            if (url.trim()) { try { const parsed = new URL(url.trim()); if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw invalid(); } catch { throw invalid(); } }
            requestCount++;
            return { id: id(request.id), name: text(request.name, 200, true), draft: {
                method: raw.method as RequestDraft['method'], url, headers: text(raw.headers, 20000), body: text(raw.body, 100000), bodyType: raw.bodyType as RequestDraft['bodyType'], timeout: raw.timeout
            } };
        }) };
    });
    if (requestCount > 1000) throw invalid();
    const result: RestCollections = { version: 1, revision: text(value.revision, 128, true), collections };
    if (new TextEncoder().encode(JSON.stringify(result)).length > 1024 * 1024) throw new Error('Collections dürfen insgesamt höchstens 1 MiB umfassen.');
    return result;
}
export function createApiRestCollectionsRepository(client: ApiClient): RestCollectionsRepository {
    const epoch = client.epoch;
    return { persistence: 'account', async load(signal) { return decodeRestCollections(await client.request('/me/rest-collections', { signal, epoch })); },
        async save(value, signal) { const input = decodeRestCollections(value); return decodeRestCollections(await client.request('/me/rest-collections', { method: 'PUT', headers: { 'If-Match': `"${input.revision}"` }, body: input, signal, epoch })); } };
}
export function createSessionRestCollectionsRepository(): RestCollectionsRepository {
    let current: RestCollections = { version: 1, revision: 'rest-initial', collections: [] }; let revision = 0;
    return { persistence: 'session', async load() { return decodeRestCollections(current); }, async save(value) {
        if (value.revision !== current.revision) throw new Error('Die Collections wurden inzwischen geändert. Bitte neu laden.');
        current = decodeRestCollections({ ...value, revision: `rest-session-${++revision}` }); return decodeRestCollections(current);
    } };
}
type Snapshot = { data: RestCollections | null; status: 'idle' | 'loading' | 'ready' | 'saving' | 'error'; error: string | null };
export function createRestCollectionsStore(repository: RestCollectionsRepository) {
    let state: Snapshot = { data: null, status: 'idle', error: null }; let generation = 0, disposed = false;
    let controller: AbortController | null = null;
    const listeners = new Set<() => void>();
    const publish = (next: Snapshot) => { if (!disposed) { state = next; listeners.forEach(listener => listener()); } };
    const failure = (error: unknown) => error instanceof Error ? error.message : 'Collections konnten nicht gespeichert werden.';
    return {
        persistence: repository.persistence,
        getSnapshot: () => state,
        subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
        async load() {
            if (disposed || state.status === 'loading' || state.status === 'saving') return;
            controller?.abort(); const request = new AbortController(); controller = request; const ticket = ++generation;
            publish({ ...state, status: 'loading', error: null });
            try { const data = decodeRestCollections(await repository.load(request.signal)); if (!disposed && ticket === generation) publish({ data, status: 'ready', error: null }); }
            catch (error) { if (!disposed && ticket === generation) publish({ ...state, status: 'error', error: failure(error) }); }
        },
        async save(collections: RestCollection[]) {
            if (disposed || state.status !== 'ready' || !state.data) return false;
            const previous = state.data; const request = new AbortController(); controller = request; const ticket = ++generation;
            publish({ ...state, status: 'saving', error: null });
            try { const input = decodeRestCollections({ ...previous, collections }); const data = decodeRestCollections(await repository.save(input, request.signal));
                if (disposed || ticket !== generation) return false; publish({ data, status: 'ready', error: null }); return true;
            } catch (error) { if (!disposed && ticket === generation) publish({ data: previous, status: 'ready', error: failure(error) }); return false; }
        },
        connect() { disposed = false; },
        dispose() { disposed = true; generation++; controller?.abort(); state = { data: null, status: 'idle', error: null }; listeners.clear(); }
    };
}
export type RestCollectionsStore = ReturnType<typeof createRestCollectionsStore>;

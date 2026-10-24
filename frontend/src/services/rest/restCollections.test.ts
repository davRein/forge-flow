import { createApiClient } from '../api/apiClient.js';
import { createApiRestCollectionsRepository, createRestCollectionsStore, createSessionRestCollectionsRepository, decodeRestCollections } from './restCollections.js';
import type { RestCollections, RestCollection } from './restCollections.js';
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const fixture = (): RestCollections => ({ version: 1, revision: 'rest-initial', collections: [{ id: '00000000-0000-0000-0000-000000000001', name: 'Private API', requests: [{ id: '00000000-0000-0000-0000-000000000002', name: 'Unicode draft', draft: { method: 'POST', url: 'https://example.test/api', headers: 'X-Test: synthetic-private-marker', body: '{"large":90071992547409931234,"text":"Grüße 😀"}', bodyType: 'json', timeout: 47 } }] }] });
export const restCollectionsTests = [
    { name: 'REST collections preserve raw drafts, clone data and reject invalid IDs, credentials, schemes and limits', run() {
        const value = fixture(); const decoded = decodeRestCollections(value); value.collections[0].requests[0].draft.body = 'mutated';
        assert(decoded.collections[0].requests[0].draft.body.includes('90071992547409931234'), 'Raw JSON and Unicode must survive without number parsing');
        const invalid: unknown[] = [ { ...fixture(), version: 2 }, { ...fixture(), collections: Array(101).fill(fixture().collections[0]) } ];
        for (const patch of [{ url: 'file:///etc/passwd' }, { url: 'https://user:password@example.test' }, { timeout: 0 }, { timeout: 1.5 }, { headers: 'x'.repeat(20001) }, { body: 'x'.repeat(100001) }]) {
            const next = fixture(); Object.assign(next.collections[0].requests[0].draft, patch); invalid.push(next);
        }
        const duplicate = fixture(); duplicate.collections[0].requests[0].id = duplicate.collections[0].id; invalid.push(duplicate);
        for (const value of invalid) { let failed = false; try { decodeRestCollections(value); } catch { failed = true; } assert(failed, 'Invalid collection accepted'); }
        const incomplete = fixture(); incomplete.collections[0].requests[0].draft.url = ''; incomplete.collections[0].requests[0].draft.body = '{unfinished';
        assert(decodeRestCollections(incomplete).collections.length === 1, 'Incomplete drafts may be saved without sending');
    } },
    { name: 'Private REST API uses CSRF and its own revision without forwarding saved headers or replaying writes', async run() {
        let calls = 0, writes = 0; const input = fixture();
        const client = createApiClient('/api/v1', async (url, init) => {
            calls++; assert(String(url) === '/api/v1/me/rest-collections', 'Account endpoint required');
            if (init?.method === 'PUT') { writes++; const headers = new Headers(init.headers);
                assert(headers.get('If-Match') === '"rest-initial"' && headers.get('X-CSRF-Token') === 'test-csrf' && !headers.has('X-Test'), 'Only application auth and revision belong in HTTP headers');
                assert(String(init.body).includes('synthetic-private-marker'), 'Request headers must be JSON data');
                return new Response(JSON.stringify({ error: { code: 'REVISION_CONFLICT', message: 'Conflict' } }), { status: 409 });
            } return new Response(JSON.stringify(input));
        }); client.setSession('test-csrf'); const repository = createApiRestCollectionsRepository(client); const signal = new AbortController().signal;
        await repository.load(signal); let failed = false; try { await repository.save(input, signal); } catch { failed = true; }
        assert(failed && writes === 1, 'Conflicting PUT must not be replayed'); client.setSession(null);
        try { await repository.load(signal); } catch { /* Old account must be rejected before HTTP. */ }
        assert(calls === 2, 'Stale account must not make another request');
    } },
    { name: 'Collection load and save failures never replace account data with examples or optimistic changes', async run() {
        const failed = createRestCollectionsStore({ persistence: 'account', async load() { throw new Error('Offline'); }, async save(value) { return value; } });
        await failed.load(); assert(failed.getSnapshot().status === 'error' && failed.getSnapshot().data === null, 'No local fallback'); failed.dispose();
        let writes = 0; const store = createRestCollectionsStore({ persistence: 'account', async load() { return fixture(); }, async save() { writes++; throw new Error('Conflict'); } });
        await store.load(); const previous = store.getSnapshot().data;
        assert(!await store.save([]) && store.getSnapshot().data === previous && store.getSnapshot().error === 'Conflict' && writes === 1, 'Failed save must retain confirmed data and report reason'); store.dispose();
    } },
    { name: 'Logout aborts collection loading and discards late private data; local preview stays session-only', async run() {
        let release!: (value: RestCollections) => void; let signal!: AbortSignal;
        const response = new Promise<RestCollections>(resolve => { release = resolve; });
        const store = createRestCollectionsStore({ persistence: 'account', async load(next) { signal = next; return response; }, async save(value) { return value; } });
        const loading = store.load(); store.dispose(); release(fixture()); await loading;
        assert(signal.aborted && store.getSnapshot().data === null, 'Late previous-account response must be discarded');
        const repository = createSessionRestCollectionsRepository(); const local = createRestCollectionsStore(repository); await local.load(); await local.save(fixture().collections); local.dispose();
        const remounted = createRestCollectionsStore(repository); await remounted.load(); assert(remounted.getSnapshot().data?.collections.length === 1, 'Same session can remount');
        assert((await createSessionRestCollectionsRepository().load(new AbortController().signal)).collections.length === 0, 'New session must not inherit local requests'); remounted.dispose();
    } },
    { name: 'Collection byte limit counts UTF-8 across all requests', run() {
        const value = fixture(); const group: RestCollection = value.collections[0]; group.requests = Array.from({ length: 6 }, (_, index) => ({ ...group.requests[0], id: `10000000-0000-0000-0000-${String(index).padStart(12, '0')}`, draft: { ...group.requests[0].draft, body: 'ü'.repeat(100000) } }));
        let failed = false; try { decodeRestCollections(value); } catch { failed = true; } assert(failed, 'UTF-8 aggregate limit missing');
    } }
];

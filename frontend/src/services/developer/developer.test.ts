import { createDeveloperRepository, decodeDeveloper, emptyDeveloper } from './developer.js';
import { createApiClient } from '../api/apiClient.js';
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
export const developerTests = [
    { name: 'Developer decoding copies public metadata and discards secret fields', run() {
        const data = decodeDeveloper({ ...emptyDeveloper(), githubToken: 'private-token', connections: [{ id: '1', name: 'DB', host: 'localhost', port: 5432, database: 'test', username: 'test', sslMode: 'require', hasPassword: true, password: 'private-password' }] });
        assert(!JSON.stringify(data).includes('private-'), 'Secrets must never enter client state');
        for (const value of [{}, { ...emptyDeveloper(), snippets: [{}] }, { ...emptyDeveloper(), connections: [{ port: '5432' }] }]) {
            let failed = false; try { decodeDeveloper(value); } catch { failed = true; } assert(failed, 'Malformed metadata must be rejected');
        }
    } },
    { name: 'Developer writes send CSRF and exact revision; errors never fall back to example data', async run() {
        const calls: { path: string; headers: Headers; body: string }[] = [];
        let fail = false;
        const api = createApiClient('/api/v1', async (url, options) => { calls.push({ path: String(url), headers: new Headers(options?.headers), body: String(options?.body) }); return fail ? new Response(JSON.stringify({ error: { code: 'VERSION_CONFLICT', message: 'Changed' } }), { status: 409 }) : new Response(JSON.stringify(emptyDeveloper())); });
        api.setSession('test-csrf'); const repository = createDeveloperRepository(api);
        await repository.request('/snippets', { code: 'const x = 1;' }, 'POST', 'revision-1');
        assert(calls[0].path === '/api/v1/me/developer/snippets' && calls[0].headers.get('If-Match') === '"revision-1"' && calls[0].headers.get('X-CSRF-Token') === 'test-csrf', 'Authenticated compare-and-swap contract missing');
        fail = true; let failed = false; try { await repository.load(); } catch { failed = true; } assert(failed, 'Load failure must remain visible');
        api.setSession(null); const before = calls.length;
        // The API client rejects responses that arrive for a superseded account.
        const epoch = api.epoch; api.setSession('new-account');
        try { await api.request('/me/developer', { epoch }); } catch { /* expected */ }
        assert(calls.length === before, 'Old accounts must not issue new requests');
    } }
];

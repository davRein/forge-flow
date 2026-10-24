import { createApiClient } from '../api/apiClient.js';
import { createApiWorkspaceRepository } from './workspaceRepository.js';
import { emptyWorkspace, decodeWorkspace } from './workspaceSchema.js';
import type { Workspace } from './workspaceTypes';

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function fixture(): Workspace {
    return { ...emptyWorkspace(), projects: [{ id: 1, name: 'Projekt', customerId: 1, deadline: '2026-12-31', planningCompleted: false }],
        customers: [{ id: 1, name: 'Kunde', street: '', city: '', country: '', email: '', phone: '', industry: '' }], files: [] };
}
export const repositoryTests = [
    { name: 'Kunden-PLZ bleibt beim Laden und Multipart-Speichern Text; alte Kunden ohne PLZ bleiben lesbar', async run() {
        const data = fixture(); const legacy = decodeWorkspace({ version: 1, revision: '1', data });
        assert(legacy.data.customers[0].postalCode === '', 'Fehlende Alt-PLZ muss leer normalisiert werden');
        data.customers[0].postalCode = '01234';
        const client = createApiClient('/api/v1', async (_url, init) => {
            if (init?.method === 'PUT') {
                assert(init.body instanceof FormData && JSON.parse(String(init.body.get('manifest'))).data.customers[0].postalCode === '01234', 'Führende Null darf beim Speichern nicht verloren gehen');
                return new Response(JSON.stringify({ revision: '2' }));
            }
            return new Response(JSON.stringify({ version: 1, revision: '1', data }));
        });
        const repository = createApiWorkspaceRepository(client); const signal = new AbortController().signal; const loaded = await repository.load(signal);
        assert(loaded.data.customers[0].postalCode === '01234', 'PLZ muss beim Laden erhalten bleiben'); await repository.save(loaded.data, loaded.revision, signal);
    } },
    { name: 'Datei-Uploads verwenden Multipart mit Manifest und werden nach Bestätigung nicht erneut gesendet', async run() {
        const data = fixture();
        data.files = [{ id: 7, projectId: 1, name: 'Grüße.txt', content: new File(['Grüße 🌍'], 'Grüße.txt', { type: 'text/plain' }), addedAt: '2026-10-18', updatedAt: '2026-10-18' }];
        let calls = 0;
        const client = createApiClient('/api/v1', async (_url, init) => {
            const form = init?.body; assert(form instanceof FormData, 'Multipart muss verwendet werden');
            assert(form.has('file-7') === (calls === 0), 'Nur neue Dateiinhalte müssen hochgeladen werden');
            const manifest = JSON.parse(String(form.get('manifest')));
            assert(manifest.data.files[0].size === data.files[0].content.size && !('content' in manifest.data.files[0]), 'Binärdaten gehören nicht ins JSON');
            assert(new Headers(init?.headers).get('If-Match') === `"${calls === 0 ? '1' : '2'}"`, 'Revision muss übertragen werden');
            calls++; return new Response(JSON.stringify({ revision: String(calls + 1) }));
        });
        const repository = createApiWorkspaceRepository(client);
        const revision = await repository.save(data, '1', new AbortController().signal);
        data.files[0] = { ...data.files[0], name: 'Neu.txt' };
        await repository.save(data, revision, new AbortController().signal);
        assert(calls === 2, 'Metadatenänderungen müssen ohne erneuten Upload gespeichert werden');
    } },
    { name: 'Workspace-Laden holt Dateien über geschützte Endpunkte und erhält deren Bytes', async run() {
        const data = fixture(); const bytes = new TextEncoder().encode('Grüße 🌍');
        const client = createApiClient('/api/v1', async (url) => {
            if (String(url).endsWith('/content')) return new Response(bytes);
            return new Response(JSON.stringify({ version: 1, revision: '1', data: { ...data, files: [{ id: 7, projectId: 1, name: 'Text.txt', size: bytes.length, mediaType: 'text/plain', lastModified: 123, addedAt: '2026-10-18', updatedAt: '2026-10-18' }] } }));
        });
        const result = await createApiWorkspaceRepository(client).load(new AbortController().signal);
        assert(await result.data.files[0].content.text() === 'Grüße 🌍' && result.data.files[0].content.lastModified === 123, 'Dateiinhalte und Metadaten müssen erhalten bleiben');
    } }
];

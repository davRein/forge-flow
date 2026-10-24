import { createApiClient, ApiError } from '../api/apiClient.js';
import { createChatRepository } from './chatRepository.js';
import type { NavigationAction } from './navigationActions.js';

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const id = '11111111-1111-4111-8111-111111111111';
export const chatRepositoryTests = [
    { name: 'Anlagebestätigung sendet nur Entscheidung und gegebenenfalls privates Initialpasswort, keine veränderbaren Nutzdaten', async run() {
        const action = { id, type: 'workspace.create' as const, entity: 'users' as const, data: { id, name: 'New account', email: 'new@example.test', administrator: false, active: true },
            revision: '1', expiresAt: '2099-01-01T00:00:00Z', status: 'proposed' as const, resultRevision: null };
        let sends = 0;
        const client = createApiClient('/api/v1', async (url, init) => {
            sends++; assert(String(url).endsWith(`/creations/${id}/decision`), 'Falscher Endpunkt');
            const input = JSON.parse(String(init?.body)) as Record<string, unknown>;
            assert(input.initialPassword === 'Synthetic-only-password-123' && !('data' in input) && !('entity' in input) && init?.credentials === 'same-origin', 'Passwort gehört ausschließlich in die private Bestätigungsanfrage');
            assert(new Headers(init?.headers).get('X-CSRF-Token') === 'test-csrf', 'CSRF fehlt');
            return Response.json({ ...action, status: 'succeeded', resultRevision: '1' });
        }); client.setSession('test-csrf');
        const result = await createChatRepository(client).createRecord(id, action, id, 'approve', new AbortController().signal, 'Synthetic-only-password-123');
        assert(sends === 1 && result.status === 'succeeded' && !JSON.stringify(result).includes('Synthetic-only-password'), 'Anlage darf nicht wiederholt werden oder Passwort zurückliefern');
    } },
    { name: 'Gesprächsverwaltung verwendet bestehende Sitzungen und prüft Listen sowie Ausführungshistorie', async run() {
        const time = '2026-10-23T12:00:00Z';
        const client = createApiClient('/api/v1', async (url, init) => {
            assert(init?.credentials === 'same-origin', 'Eigene Sitzung fehlt');
            if (init.method === 'DELETE') { assert(new Headers(init.headers).get('X-CSRF-Token') === 'test-csrf', 'Löschen verlangt CSRF'); return new Response(null, { status: 204 }); }
            if (String(url).endsWith('/executions')) return Response.json([{ id, requestId: id, status: 'failed', startedAt: time, finishedAt: time, errorCode: 'AI_UNAVAILABLE', steps: [] }]);
            return Response.json({ storage: 'postgresql', retentionSeconds: 2592000, items: [{ id, language: 'en', title: 'Test title', createdAt: time, updatedAt: time, messageCount: 2, busy: false }] });
        }); client.setSession('test-csrf'); const repository = createChatRepository(client); const signal = new AbortController().signal;
        assert((await repository.list(signal)).items[0].id === id && (await repository.executions(id, signal))[0].status === 'failed', 'Verwaltungsergebnisse fehlen');
        await repository.remove(id, signal);
        for (const invalid of [{ storage: 'unknown', retentionSeconds: 30, items: [] }, { storage: 'postgresql', retentionSeconds: 2592000, items: Array(51).fill({}) }]) {
            const bad = createChatRepository(createApiClient('/api/v1', async () => Response.json(invalid)));
            let failed = false; try { await bad.list(signal); } catch (error) { failed = error instanceof ApiError && error.code === 'AI_INVALID_RESPONSE'; }
            assert(failed, 'Ungültige Listen dürfen nicht angezeigt werden');
        }
    } },
    { name: 'Bestätigte Nachrichten akzeptieren begrenzte Werkzeugfolgen und verweigern doppelte Kennungen oder zu viele Schritte', async run() {
        const tool = { id, name: 'list_projects', status: 'completed', result: { outcome: 'OK', revision: '1', readAt: '2026-10-23T12:00:00Z', projects: [], tasks: [], total: 0, offset: 0, more: false, textTruncated: false } };
        for (const [count, duplicate] of [[6, false], [7, false], [2, true]] as const) {
            const tools = Array.from({ length: count }, (_, index) => ({ ...tool, id: duplicate ? id : `00000000-0000-4000-8000-${String(index).padStart(12, '0')}` }));
            const client = createApiClient('/api/v1', async () => Response.json({ id, language: 'de', messages: [
                { id, role: 'user', content: 'Hello', createdAt: tool.result.readAt }, { id, role: 'assistant', content: 'Result', createdAt: tool.result.readAt, tools }
            ] }));
            let failed = false;
            try { await createChatRepository(client).load(id, new AbortController().signal); } catch (error) { failed = error instanceof ApiError && error.code === 'AI_INVALID_RESPONSE'; }
            assert(failed === (count > 6 || duplicate), 'Ungültige Werkzeugfolge darf nicht in den Verlauf gelangen');
        }
    } },
    { name: 'Chat empfängt begrenzte Ausführungsphasen und weist unbekannte Phasen ab', async run() {
        for (const phase of ['thinking', 'script']) {
            const client = createApiClient('/api/v1', async () => new Response(`event: execution\ndata: ${JSON.stringify({ phase, step: 0, maxSteps: 4 })}\n\nevent: cancelled\ndata: ${JSON.stringify({ requestId: id })}\n\n`, { headers: { 'Content-Type': 'text/event-stream' } }));
            let received = false, failed = false;
            try { await createChatRepository(client).send(id, id, 'Hallo', new AbortController().signal, event => { if (event.kind === 'execution') received = true; }); }
            catch (error) { failed = error instanceof ApiError && error.code === 'AI_INVALID_RESPONSE'; }
            assert(received === (phase === 'thinking') && failed === (phase === 'script'), 'Phasen müssen vor Darstellung validiert sein');
        }
    } },
    { name: 'Aktionsfreigaben senden nur Entscheidung und Kennungen mit Cookies/CSRF und prüfen unveränderliche Ziele', async run() {
        const action: NavigationAction = { id, type: 'project.open', projectId: 17, projectName: 'Alpha', projectTab: 'overview', expiresAt: '2099-01-01T00:00:00Z', status: 'proposed', resultCode: null };
        for (const mismatch of [false, true]) {
            const client = createApiClient('/api/v1', async (url, init) => {
                const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
                assert(String(url).endsWith(`/actions/${id}/decision`) && init?.credentials === 'same-origin' && new Headers(init.headers).get('X-CSRF-Token') === 'test-csrf', 'Sicherheitsschutz fehlt');
                assert(Object.keys(body).sort().join() === 'decision,decisionId', 'Client darf Ziel oder Rechte nicht festlegen');
                return Response.json({ action: { ...action, status: 'approved', projectId: mismatch ? 42 : 17 }, executionId: id });
            }); client.setSession('test-csrf');
            let failed = false;
            try { await createChatRepository(client).decide(id, action, id, 'approve', new AbortController().signal); }
            catch (error) { failed = error instanceof ApiError && error.code === 'AI_INVALID_RESPONSE'; }
            assert(failed === mismatch, 'Ausgetauschte Ziele müssen scheitern');
        }
    } },
    { name: 'Chat sendet begrenzten Kontext und prüft dessen Zuordnung in bestätigten Antworten', async run() {
        const page = { route: '/projectManager/projects', projectId: 17, projectTab: 'tasks' as const };
        for (const wrongContext of [false, true]) {
            const client = createApiClient('/api/v1', async (_url, init) => {
                const input = JSON.parse(String(init?.body)) as { context: typeof page };
                assert(input.context.projectId === 17 && Object.keys(input.context).length === 3, 'Seitenkontext muss im Body sein');
                const user = { id, role: 'user', content: 'Hallo', createdAt: '2026-10-23T12:00:00Z', context: { ...page, projectId: wrongContext ? 42 : 17 } };
                const assistant = { id, role: 'assistant', content: 'Antwort', createdAt: user.createdAt };
                return new Response(`event: done\ndata: ${JSON.stringify({ requestId: id, user, assistant, truncated: false })}\n\n`, { headers: { 'Content-Type': 'text/event-stream' } });
            });
            let failed = false;
            try { await createChatRepository(client).send(id, id, 'Hallo', new AbortController().signal, () => {}, page); }
            catch (error) { failed = error instanceof ApiError && error.code === 'AI_INVALID_RESPONSE'; }
            assert(failed === wrongContext, 'Antwort muss zum gesendeten Kontext passen');
        }
    } },
    { name: 'Chat überträgt CSRF/Cookies und meldet Sitzungsablauf auch innerhalb eines Streams', async run() {
        let expired = 0;
        const client = createApiClient('/api/v1', async (_url, init) => {
            assert(new Headers(init?.headers).get('X-CSRF-Token') === 'test-csrf' && init?.credentials === 'same-origin', 'Chat muss bestehenden Sicherheitsschutz verwenden');
            return new Response('event: error\ndata: {"status":401,"code":"UNAUTHENTICATED","message":"Bitte anmelden."}\n\n', { headers: { 'Content-Type': 'text/event-stream' } });
        });
        client.setSession('test-csrf'); client.onUnauthorized(() => { expired++; });
        let failed = false;
        try { await createChatRepository(client).send(id, id, 'Hallo', new AbortController().signal, () => {}); }
        catch (error) { failed = error instanceof ApiError && error.status === 401; }
        assert(failed && expired === 1, 'Stream-401 muss die ursprüngliche Sitzung beenden');
    } },
    { name: 'Chat weist unbekannte Ereignisse und falsche Zuordnung einer Abschlussantwort ab', async run() {
        for (const event of ['event: tool\ndata: {}\n\n', 'event: done\ndata: {"requestId":"other"}\n\n']) {
            const client = createApiClient('/api/v1', async () => new Response(event, { headers: { 'Content-Type': 'text/event-stream' } }));
            let failed = false;
            try { await createChatRepository(client).send(id, id, 'Hallo', new AbortController().signal, () => {}); }
            catch (error) { failed = error instanceof ApiError && error.code === 'AI_INVALID_RESPONSE'; }
            assert(failed, 'Nicht zugeordnete oder unbekannte Ereignisse müssen scheitern');
        }
    } }
];

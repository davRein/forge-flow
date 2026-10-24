import { ApiError, createApiClient } from './apiClient.js';

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
export const apiTests = [
    { name: 'Verspätete Antworten und Streams einer alten Sitzung werden nicht übernommen', async run() {
        for (const stream of [false, true]) {
            let finish!: (response: Response) => void;
            const client = createApiClient('/api/v1', async () => new Promise<Response>(resolve => { finish = resolve; }));
            client.setSession('old'); const request = client.request('/workspace', stream
                ? { responseType: 'stream', consume: async () => { throw new Error('Alter Stream darf nicht gelesen werden'); } } : {});
            client.setSession('new');
            finish(new Response('{}', { headers: { 'Content-Type': stream ? 'text/event-stream' : 'application/json' } }));
            let failed = false;
            try { await request; } catch (error) { failed = error instanceof ApiError && error.code === 'STALE_SESSION'; }
            assert(failed, 'Verspätete Antwort einer fremden Sitzung muss verworfen werden');
        }
    } },
    { name: 'API-Anfragen haben ein Zeitlimit und behalten explizite Abbrüche bei', async run() {
        const client = createApiClient('/api/v1', async (_url, init) => new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new DOMException('Abgebrochen', 'AbortError')), { once: true });
        }), 5);
        let timedOut = false;
        try { await client.request('/workspace'); } catch (error) { timedOut = error instanceof ApiError && error.code === 'TIMEOUT'; }
        assert(timedOut, 'Eine ausbleibende Antwort darf die Oberfläche nicht dauerhaft blockieren');
    } },
    { name: 'API-Client sendet Cookies nur an dieselbe Domain und CSRF nur bei Änderungen', async run() {
        const calls: RequestInit[] = [];
        const client = createApiClient('/api/v1', async (_url, init) => { calls.push(init!); return new Response('{}'); });
        client.setSession('csrf');
        await client.request('/workspace'); await client.request('/me/settings', { method: 'PUT', body: { version: 1 } });
        assert(calls[0].credentials === 'same-origin' && calls[0].redirect === 'error' && calls[0].cache === 'no-store', 'Sitzung und Weiterleitungen müssen begrenzt sein');
        assert(!new Headers(calls[0].headers).has('X-CSRF-Token'), 'GET benötigt keinen CSRF-Header');
        assert(new Headers(calls[1].headers).get('X-CSRF-Token') === 'csrf', 'Schreibanfragen benötigen CSRF');
    } },
    { name: 'Alte Sitzungen dürfen keine neuen Anfragen unter einem anderen Benutzer auslösen', async run() {
        let calls = 0;
        const client = createApiClient('/api/v1', async () => { calls++; return new Response('{}'); });
        client.setSession('A'); const epoch = client.epoch; client.setSession('B');
        let failed = false;
        try { await client.request('/workspace', { epoch }); } catch (error) { failed = error instanceof ApiError && error.code === 'STALE_SESSION'; }
        assert(failed && calls === 0, 'Veraltete Operation darf nicht gesendet werden');
    } },
    { name: '401 beendet nur die zugehörige Sitzung, fehlgeschlagener Login bleibt separat', async run() {
        let expired = 0;
        const client = createApiClient('/api/v1', async () => new Response('{"error":{"code":"UNAUTHENTICATED","message":"Bitte anmelden."}}', { status: 401 }));
        client.onUnauthorized(() => { expired++; });
        try { await client.request('/auth/login', { auth: false }); } catch { /* expected */ }
        assert(expired === 0, 'Ein falsches Passwort darf keinen Ablauf anderer Sitzungen melden');
        try { await client.request('/workspace'); } catch (error) { assert(error instanceof ApiError && error.status === 401, 'HTTP-Status muss erhalten bleiben'); }
        assert(Number(expired) === 1, 'Geschützter Zugriff muss Sitzung beenden');
    } },
    { name: 'Multipart setzt keinen eigenen Content-Type und 204 benötigt kein JSON', async run() {
        const form = new FormData(); form.append('manifest', '{}');
        const client = createApiClient('/api/v1', async (_url, init) => {
            assert(init?.body === form && !new Headers(init.headers).has('Content-Type'), 'Der Browser muss die Multipart-Grenze setzen');
            return new Response(null, { status: 204 });
        });
        assert(await client.request('/workspace', { method: 'PUT', body: form }) === undefined, '204 muss erfolgreich sein');
    } }
];

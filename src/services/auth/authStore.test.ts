import { createApiClient } from '../api/apiClient.js';
import { createAuthStore } from './authStore.js';

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const profile = { user: { id: 'A', email: 'a@example.test', name: 'A' }, csrfToken: 'signed-in-token' };
export const authTests = [
    { name: 'Lokaler Modus führt keine Anmeldung oder API-Anfrage aus', async run() {
        let calls = 0;
        const client = createApiClient('/api/v1', async () => { calls++; return new Response('{}'); });
        const store = createAuthStore(client, false); store.connect(); await store.refresh(); await store.login('a', 'pass');
        assert(store.getSnapshot().status === 'local' && calls === 0, 'Lokaler Modus muss eigenständig bleiben');
    } },
    { name: 'Login holt zunächst CSRF, übernimmt die Serversitzung und rotiert den Token', async run() {
        const paths: string[] = [];
        const client = createApiClient('/api/v1', async (url, init) => {
            paths.push(String(url));
            if (String(url).endsWith('/csrf')) return new Response('{"csrfToken":"anonymous-token"}');
            assert(new Headers(init?.headers).get('X-CSRF-Token') === 'anonymous-token', 'Login muss CSRF-geschützt sein');
            assert(JSON.parse(String(init?.body)).password === '  Passwort-123  ', 'Passwörter dürfen nicht getrimmt werden');
            return new Response(JSON.stringify(profile));
        });
        const store = createAuthStore(client, true); await store.login('a@example.test', '  Passwort-123  ');
        assert(paths.join(',') === '/api/v1/auth/csrf,/api/v1/auth/login' && store.getSnapshot().user?.id === 'A', 'Die richtige Reihenfolge ist erforderlich');
        const epoch = client.epoch;
        client.onUnauthorized(null);
        assert(store.getSnapshot().epoch === epoch && epoch === 2, 'Authentifizierte Sitzung benötigt einen eigenen Gültigkeitsbereich');
    } },
    { name: 'Verspätete Sitzungsprüfungen überschreiben keine Anmeldung', async run() {
        let finish: (response: Response) => void = () => {};
        const client = createApiClient('/api/v1', async (url) => {
            if (String(url).endsWith('/session')) return new Promise<Response>((resolve) => { finish = resolve; });
            return new Response(JSON.stringify(String(url).endsWith('/csrf') ? { csrfToken: 'anonymous' } : profile));
        });
        const store = createAuthStore(client, true); const pending = store.refresh();
        await store.login('a@example.test', 'Passwort-12345'); finish(new Response('{}', { status: 401 })); await pending;
        assert(store.getSnapshot().user?.id === 'A', 'Alte Antwort darf Anmeldung nicht löschen');
    } },
    { name: 'Abmelden beendet die Sitzung erst nach Bestätigung des Servers', async run() {
        const client = createApiClient('/api/v1', async (url) => String(url).endsWith('/logout') ? new Response('{}', { status: 500 })
            : new Response(JSON.stringify(profile)));
        const store = createAuthStore(client, true); await store.refresh(); await store.logout();
        assert(store.getSnapshot().status === 'authenticated' && store.getSnapshot().error, 'Fehler darf keine erfolgreiche Abmeldung vortäuschen');
        // 204 is tested separately with an empty response body.
        const successful = createApiClient('/api/v1', async (url) => String(url).endsWith('/logout') ? new Response(null, { status: 204 }) : new Response(JSON.stringify(profile)));
        const second = createAuthStore(successful, true); await second.refresh(); await second.logout();
        assert(second.getSnapshot().status === 'anonymous' && !second.getSnapshot().user, 'Bestätigte Abmeldung muss Benutzerdaten entfernen');
    } }
];

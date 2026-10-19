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
    } },
    { name: 'Profiländerungen erneuern die Sitzung und geben keine Passwörter an den Zustand weiter', async run() {
        const client = createApiClient('/api/v1', async (url, init) => {
            if (String(url).endsWith('/me/profile')) {
                assert(JSON.parse(String(init?.body)).currentPassword === '  Passwort-12345  ', 'Bestätigungspasswort unverändert übertragen');
                return new Response(JSON.stringify({ user: { ...profile.user, name: 'Neu', administrator: true }, csrfToken: 'erneuert' }));
            }
            return new Response(JSON.stringify(profile));
        });
        const store = createAuthStore(client, true); await store.refresh();
        const previousEpoch = client.epoch;
        assert(await store.updateProfile({ name: ' Neu ', email: profile.user.email, currentPassword: '  Passwort-12345  ' }), 'Profiländerung muss bestätigt werden');
        assert(store.getSnapshot().user?.name === 'Neu' && store.getSnapshot().user?.administrator, 'Profil und Rechte übernehmen');
        assert(client.epoch > previousEpoch && !JSON.stringify(store.getSnapshot()).includes('Passwort-12345'), 'Sitzung erneuern und keine Zugangsdaten speichern');
    } },
    { name: 'Fehlgeschlagene Passwortänderung erhält die Anmeldung, Erfolg verlangt erneuten Login', async run() {
        let failure = true;
        const client = createApiClient('/api/v1', async (url) => String(url).endsWith('/me/password')
            ? failure ? new Response('{"error":{"message":"Aktuelles Passwort falsch"}}', { status: 400 }) : new Response(null, { status: 204 })
            : new Response(JSON.stringify(profile)));
        const store = createAuthStore(client, true); await store.refresh();
        assert(!await store.changePassword('falsch', 'Neues-Passwort-12345'), 'Fehler muss erkennbar bleiben');
        assert(store.getSnapshot().status === 'authenticated' && store.getSnapshot().error, 'Fehler darf nicht abmelden');
        failure = false;
        assert(await store.changePassword('richtig', 'Neues-Passwort-12345'), 'Erfolg muss bestätigt werden');
        assert(store.getSnapshot().status === 'anonymous' && store.getSnapshot().user === null && store.getSnapshot().notice, 'Nach Erfolg erneut anmelden');
    } },
    { name: 'Verspätete Profilantworten dürfen eine neue Anmeldung nicht überschreiben', async run() {
        let finish: (response: Response) => void = () => {};
        const client = createApiClient('/api/v1', async (url) => {
            if (String(url).endsWith('/me/profile')) return new Promise<Response>((resolve) => { finish = resolve; });
            if (String(url).endsWith('/workspace')) return new Response('{}', { status: 401 });
            if (String(url).endsWith('/csrf')) return new Response('{"csrfToken":"anonymous"}');
            if (String(url).endsWith('/login')) return new Response(JSON.stringify({ user: { id: 'B', email: 'b@example.test', name: 'B' }, csrfToken: 'B' }));
            return new Response(JSON.stringify(profile));
        });
        const store = createAuthStore(client, true); store.connect(); await store.refresh();
        const pending = store.updateProfile({ name: 'Alt', email: profile.user.email, currentPassword: '' });
        try { await client.request('/workspace'); } catch { /* Session expiry is expected. */ }
        await store.login('b@example.test', 'Passwort-12345');
        finish(new Response(JSON.stringify(profile))); await pending;
        assert(store.getSnapshot().user?.id === 'B', 'Profil einer alten Sitzung muss verworfen werden');
    } }
];

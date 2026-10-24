import { createApiClient } from '../api/apiClient.js';
import { createGlobalSettingsRepository, createGlobalSettingsStore, createSessionGlobalSettingsRepository, normalizeIndustries } from './globalSettings.js';
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
export const globalSettingsTests = [
    { name: 'Globale Branchen verwenden eigene Revision, CSRF und geschützten API-Endpunkt', async run() {
        let writes = 0;
        const client = createApiClient('/api/v1', async (url, init) => {
            assert(String(url).endsWith('/settings/global'), 'Globaler Endpunkt fehlt');
            if (init?.method === 'PUT') {
                writes++; const headers = new Headers(init.headers); assert(headers.get('If-Match') === '"global-1"' && headers.get('X-CSRF-Token') === 'test-csrf', 'Revision und CSRF müssen mitgesendet werden');
                assert(JSON.parse(String(init.body)).industries[0] === 'Handwerk', 'Werte müssen normalisiert werden');
            }
            return new Response(JSON.stringify({ revision: 'global-1', industries: ['Handwerk'] }));
        });
        client.setSession('test-csrf'); const repository = createGlobalSettingsRepository(client); const signal = new AbortController().signal;
        await repository.load(signal); await repository.save({ revision: 'global-1', industries: ['  Handwerk  '] }, signal); assert(writes === 1, 'Genau ein expliziter Schreibaufruf');
        client.setSession(null); let stale = false; try { await repository.load(signal); } catch { stale = true; } assert(stale, 'Alte Sitzung darf keine globale Anfrage senden');
    } },
    { name: 'Branchenvalidierung verhindert leere, doppelte, zu lange und Kontrollzeichen enthaltende Einträge', run() {
        for (const value of [[], ['Same', 'same'], [''], ['a'.repeat(101)], ['bad\nname'], ['Ä', 'A\u0308']]) {
            let failed = false; try { normalizeIndustries(value); } catch { failed = true; } assert(failed, 'Ungültige Branche wurde akzeptiert');
        }
        assert(normalizeIndustries([' IT ', 'Handwerk']).join(',') === 'IT,Handwerk', 'Normale Werte müssen erhalten bleiben');
    } },
    { name: 'Katalogfehler erzeugen keine Beispielwerte und bewahren den bestehenden Stand bei Speicherfehlern', async run() {
        const failed = createGlobalSettingsStore({ async load() { throw new Error('Load failed'); }, async save(value) { return value; } });
        await failed.load(); assert(failed.getSnapshot().data === null && failed.getSnapshot().status === 'error', 'API-Fehler darf keinen lokalen Katalog erzeugen'); failed.dispose();
        let writes = 0;
        const store = createGlobalSettingsStore({ async load() { return { revision: '1', industries: ['Old'] }; }, async save() { writes++; throw new Error('Conflict'); } });
        await store.load(); assert(!await store.save(['New']) && store.getSnapshot().data?.industries[0] === 'Old' && store.getSnapshot().error === 'Conflict', 'Fehler darf alte Branchen nicht überschreiben');
        assert(writes === 1, 'Kein automatischer Schreibwiederholungsversuch'); store.dispose();
    } },
    { name: 'Globale Antworten nach Logout werden verworfen und lokale Vorschau speichert nur in der Sitzung', async run() {
        let release: (value: { revision: string; industries: string[] }) => void = () => {};
        const pending = new Promise<{ revision: string; industries: string[] }>(resolve => { release = resolve; });
        const store = createGlobalSettingsStore({ async load() { return pending; }, async save(value) { return value; } });
        const loading = store.load(); store.dispose(); release({ revision: 'foreign', industries: ['Late'] }); await loading;
        assert(store.getSnapshot().data === null, 'Alte Antwort muss verworfen werden');
        const local = createGlobalSettingsStore(createSessionGlobalSettingsRepository()); await local.load(); await local.save(['Local']);
        assert(local.getSnapshot().data?.industries[0] === 'Local', 'Lokaler Modus muss ohne HTTP benutzbar sein'); local.dispose();
    } }
];

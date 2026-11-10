import { createApiClient } from '../api/apiClient.js';
import { createGlobalSettingsRepository, createGlobalSettingsStore, createSessionGlobalSettingsRepository, normalizeIndustries } from './globalSettings.js';
import { defaultAiApps, defaultVisibleApps } from './globalSettings.js';
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
export const globalSettingsTests = [
    { name: 'DataScout is selectable in local global app settings without dropping saved choices', async run() {
        const repository = createSessionGlobalSettingsRepository();
        const current = await repository.load(new AbortController().signal);
        assert(current.visibleApps.includes('dataScout'), 'Local preview must include DataScout');
        const selected = await repository.save({ ...current, visibleApps: ['wiki', 'dataScout'], aiApps: [] }, new AbortController().signal);
        assert(selected.visibleApps.join(',') === 'wiki,dataScout', 'DataScout selection must preserve other apps');
    } },
    { name: 'Globale Branchen verwenden eigene Revision, CSRF und geschützten API-Endpunkt', async run() {
        let writes = 0;
        const client = createApiClient('/api/v1', async (url, init) => {
            assert(String(url).endsWith('/settings/global'), 'Globaler Endpunkt fehlt');
            if (init?.method === 'PUT') {
                writes++; const headers = new Headers(init.headers); assert(headers.get('If-Match') === '"global-1"' && headers.get('X-CSRF-Token') === 'test-csrf', 'Revision und CSRF müssen mitgesendet werden');
                assert(JSON.parse(String(init.body)).industries[0] === 'Handwerk', 'Werte müssen normalisiert werden');
            }
            return new Response(JSON.stringify({ revision: 'global-1', industries: ['Handwerk'], visibleApps: defaultVisibleApps, aiApps: defaultAiApps }));
        });
        client.setSession('test-csrf'); const repository = createGlobalSettingsRepository(client); const signal = new AbortController().signal;
        const loaded = await repository.load(signal);
        await repository.save({ ...loaded, industries: ['  Handwerk  '] }, signal); assert(writes === 1, 'Genau ein expliziter Schreibaufruf');
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
        const current = { revision: '1', industries: ['Old'], visibleApps: defaultVisibleApps, aiApps: defaultAiApps };
        const store = createGlobalSettingsStore({ async load() { return current; }, async save() { writes++; throw new Error('Conflict'); } });
        await store.load(); assert(!await store.save({ industries: ['New'] }) && store.getSnapshot().data?.industries[0] === 'Old' && store.getSnapshot().error === 'Conflict', 'Fehler darf alte Branchen nicht überschreiben');
        assert(writes === 1, 'Kein automatischer Schreibwiederholungsversuch'); store.dispose();
    } },
    { name: 'Globale Antworten nach Logout werden verworfen und lokale Vorschau speichert nur in der Sitzung', async run() {
        let release: (value: { revision: string; industries: string[]; visibleApps: typeof defaultVisibleApps; aiApps: typeof defaultAiApps }) => void = () => {};
        const pending = new Promise<{ revision: string; industries: string[]; visibleApps: typeof defaultVisibleApps; aiApps: typeof defaultAiApps }>(resolve => { release = resolve; });
        const store = createGlobalSettingsStore({ async load() { return pending; }, async save(value) { return value; } });
        const loading = store.load(); store.dispose(); release({ revision: 'foreign', industries: ['Late'], visibleApps: defaultVisibleApps, aiApps: defaultAiApps }); await loading;
        assert(store.getSnapshot().data === null, 'Alte Antwort muss verworfen werden');
        const local = createGlobalSettingsStore(createSessionGlobalSettingsRepository()); await local.load(); await local.save({ industries: ['Local'] });
        assert(local.getSnapshot().data?.industries[0] === 'Local', 'Lokaler Modus muss ohne HTTP benutzbar sein'); local.dispose();
    } }
];

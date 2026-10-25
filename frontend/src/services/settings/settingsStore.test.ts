import { defaultSettings } from '../../config/appSettings.js';
import type { SettingsRepository, StoredSettings } from './settingsRepository';
import { decodeSettings, encodeSettings } from './settingsSerialization.js';
import { createSessionSettingsRepository } from './sessionSettingsRepository.js';
import { createSettingsStore } from './settingsStore.js';

function assert(value: unknown, message: string): asserts value {
    if (!value) throw new Error(message);
}

function equal(actual: unknown, expected: unknown) {
    assert(JSON.stringify(actual) === JSON.stringify(expected), `Erwartet ${JSON.stringify(expected)}, erhalten ${JSON.stringify(actual)}`);
}

function deferred<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    const promise = new Promise<T>((accept) => { resolve = accept; });
    return { promise, resolve };
}

export const settingsTests = [
    { name: 'Aurora and Dune survive settings reloads without changing other preferences or accounts', async run() {
        const repository = createSessionSettingsRepository();
        for (const themeMode of ['aurora', 'dune'] as const) {
            const expected = { ...defaultSettings, themeMode, language: 'de' as const, defaultTaskPriority: 'high' as const };
            const store = createSettingsStore(repository, themeMode);
            await store.load();
            store.updateSettings(expected);
            await store.whenIdle();
            equal(store.getSnapshot().status, 'ready');
            const reloaded = createSettingsStore(repository, themeMode);
            await reloaded.load();
            equal(reloaded.getSnapshot().settings, expected);
        }
        equal(decodeSettings(await repository.load('aurora')).themeMode, 'aurora');
        equal(decodeSettings(await repository.load('dune')).themeMode, 'dune');
        equal(decodeSettings({ version: 1, settings: { ...defaultSettings, themeMode: 'unknown' } }).themeMode, defaultSettings.themeMode);
    } },
    { name: 'Discard failed preferences restores the latest confirmed settings without another write', async run() {
        let fail = false, writes = 0;
        const store = createSettingsStore({ persistence: 'account', async load() { return null; }, async save() { writes++; if (fail) throw new Error('Offline'); } }, 'discard-test', 'en');
        await store.load(); store.updateSettings({ ...store.getSnapshot().settings, themeMode: 'light' }); await store.whenIdle();
        fail = true; store.updateSettings({ ...store.getSnapshot().settings, language: 'de' }); await store.whenIdle();
        store.discardUnsaved(); assert(store.getSnapshot().settings.language === 'en' && store.getSnapshot().settings.themeMode === 'light' && store.getSnapshot().status === 'ready' && writes === 2, 'Discard must keep confirmed preferences without replaying a write');
    } },
    { name: 'Sprache wird pro Konto gespeichert und alte Einstellungen bleiben kompatibel', async run() {
        const repository = createSessionSettingsRepository();
        await repository.save('anna', encodeSettings({ ...defaultSettings, language: 'en' }));
        await repository.save('ben', encodeSettings({ ...defaultSettings, language: 'de' }));
        equal(decodeSettings(await repository.load('anna')).language, 'en');
        equal(decodeSettings(await repository.load('ben')).language, 'de');
        equal(decodeSettings({ version: 1, settings: { themeMode: 'light', defaultProjectView: 'projects', defaultTaskPriority: 'high' } }),
            { ...defaultSettings, themeMode: 'light', defaultProjectView: 'projects', defaultTaskPriority: 'high', language: 'en' });
        equal(decodeSettings({ version: 1, settings: { language: 'fr' } }).language, 'en');
    } },
    { name: 'Regionsvorgabe gilt nur ohne gültige Kontosprache und schreibt beim Laden keine Einstellungen', async run() {
        let saves = 0;
        let record: unknown = null;
        const repository: SettingsRepository = { persistence: 'account', async load() { return record; }, async save() { saves++; } };
        const store = createSettingsStore(repository, 'anna', 'de');
        equal(store.getSnapshot().settings.language, 'de');
        await store.load(); equal(store.getSnapshot().settings.language, 'de');
        record = encodeSettings({ ...defaultSettings, language: 'en' });
        await store.load(); equal(store.getSnapshot().settings.language, 'en');
        equal(saves, 0);
        const english = createSettingsStore(repository, 'ben', 'en');
        record = encodeSettings({ ...defaultSettings, language: 'de' });
        await english.load(); equal(english.getSnapshot().settings.language, 'de');
    } },
    { name: 'Einstellungen sind pro Benutzer und gegenüber der anonymen Sitzung getrennt', async run() {
        const repository = createSessionSettingsRepository();
        await repository.save('anna', encodeSettings({ ...defaultSettings, themeMode: 'light' }));
        await repository.save('ben', encodeSettings({ ...defaultSettings, defaultTaskPriority: 'high' }));
        await repository.save(null, encodeSettings({ ...defaultSettings, defaultProjectView: 'projects' }));
        equal(decodeSettings(await repository.load('anna')), { ...defaultSettings, themeMode: 'light' });
        equal(decodeSettings(await repository.load('ben')), { ...defaultSettings, defaultTaskPriority: 'high' });
        equal(decodeSettings(await repository.load(null)), { ...defaultSettings, defaultProjectView: 'projects' });
        equal(await repository.load('neu'), null);
    } },
    { name: 'Gespeicherte Daten werden kopiert und können nicht über fremde Referenzen verändert werden', async run() {
        const repository = createSessionSettingsRepository();
        const record = encodeSettings({ ...defaultSettings, themeMode: 'light' });
        await repository.save('anna', record);
        record.settings.themeMode = 'dark';
        const loaded = await repository.load('anna') as StoredSettings;
        equal(loaded.settings.themeMode, 'light');
        loaded.settings.defaultTaskPriority = 'high';
        equal(decodeSettings(await repository.load('anna')).defaultTaskPriority, 'medium');
    } },
    { name: 'Fehlende oder ungültige Einzelwerte erhalten Vorgaben und unbekannte Felder werden nicht übernommen', run() {
        equal(decodeSettings(null), defaultSettings);
        const decoded = decodeSettings({ version: 1, settings: { themeMode: 'light', defaultProjectView: 'ungueltig', unknown: true } });
        equal(decoded, { ...defaultSettings, themeMode: 'light' });
        const first = decodeSettings(null);
        first.themeMode = 'light';
        equal(decodeSettings(null), defaultSettings);
    } },
    { name: 'Unbekannte Datenversionen verursachen einen Ladefehler und werden nicht überschrieben', async run() {
        let saves = 0;
        const repository: SettingsRepository = {
            persistence: 'account',
            async load() { return { version: 2, settings: { themeMode: 'light' } }; },
            async save() { saves++; }
        };
        const store = createSettingsStore(repository, 'anna');
        await store.load();
        equal(store.getSnapshot().error?.operation, 'load');
        store.updateSettings({ ...defaultSettings, themeMode: 'light' });
        await store.whenIdle();
        equal(saves, 0);
    } },
    { name: 'Benutzerwerte werden vor Änderungen geladen und ein neuer Benutzer erhält eigene Vorgaben', async run() {
        const repository = createSessionSettingsRepository();
        await repository.save('anna', encodeSettings({ ...defaultSettings, defaultProjectView: 'projects' }));
        const anna = createSettingsStore(repository, 'anna');
        equal(anna.getSnapshot().status, 'loading');
        anna.updateSettings({ ...defaultSettings, themeMode: 'light' });
        await anna.load();
        equal(anna.getSnapshot().settings, { ...defaultSettings, defaultProjectView: 'projects' });
        const ben = createSettingsStore(repository, 'ben');
        await ben.load();
        equal(ben.getSnapshot().settings, defaultSettings);
    } },
    { name: 'Schnelle Änderungen werden in Reihenfolge gespeichert und ältere Erfolge überschreiben keine neuen Werte', async run() {
        const firstStarted = deferred<void>();
        const firstSave = deferred<void>();
        const calls: StoredSettings[] = [];
        const repository: SettingsRepository = {
            persistence: 'account',
            async load() { return null; },
            async save(userId, record) {
                equal(userId, 'anna');
                calls.push(record);
                if (calls.length === 1) { firstStarted.resolve(); await firstSave.promise; }
            }
        };
        const store = createSettingsStore(repository, 'anna');
        await store.load();
        const first = { ...defaultSettings, themeMode: 'light' as const };
        store.updateSettings(first);
        store.updateSettings({ ...first, defaultTaskPriority: 'high' });
        await firstStarted.promise;
        equal(calls.length, 1);
        equal(store.getSnapshot().settings.defaultTaskPriority, 'high');
        equal(store.getSnapshot().status, 'saving');
        firstSave.resolve();
        await store.whenIdle();
        equal(calls.length, 2);
        equal(calls[1].settings.defaultTaskPriority, 'high');
        equal(store.getSnapshot().status, 'ready');
    } },
    { name: 'Speicherfehler behalten die Auswahl und Wiederholen speichert dieselben Werte', async run() {
        const memory = createSessionSettingsRepository();
        let fail = true;
        const repository: SettingsRepository = {
            persistence: 'account', load: memory.load,
            async save(userId, record) {
                if (fail) throw new Error('offline');
                await memory.save(userId, record);
            }
        };
        const store = createSettingsStore(repository, 'anna');
        await store.load();
        store.updateSettings({ ...defaultSettings, themeMode: 'light' });
        await store.whenIdle();
        equal(store.getSnapshot().error?.operation, 'save');
        equal(store.getSnapshot().settings.themeMode, 'light');
        equal(await memory.load('anna'), null);
        fail = false;
        store.retry();
        await store.whenIdle();
        equal(store.getSnapshot().status, 'ready');
        equal(store.getSnapshot().error, null);
        equal(decodeSettings(await memory.load('anna')).themeMode, 'light');
    } },
    { name: 'Ein fehlgeschlagener älterer Schreibvorgang blockiert keine spätere Änderung', async run() {
        let count = 0;
        const memory = createSessionSettingsRepository();
        const repository: SettingsRepository = {
            persistence: 'account', load: memory.load,
            async save(userId, record) {
                if (++count === 1) throw new Error('temporary');
                await memory.save(userId, record);
            }
        };
        const store = createSettingsStore(repository, 'anna');
        await store.load();
        store.updateSettings({ ...defaultSettings, themeMode: 'light' });
        store.updateSettings({ ...defaultSettings, themeMode: 'light', defaultTaskPriority: 'high' });
        await store.whenIdle();
        equal(store.getSnapshot().status, 'ready');
        equal(decodeSettings(await memory.load('anna')).defaultTaskPriority, 'high');
    } },
    { name: 'Zurücksetzen wird nach ausstehenden Änderungen und nur für den aktuellen Benutzer gespeichert', async run() {
        const memory = createSessionSettingsRepository();
        await memory.save('ben', encodeSettings({ ...defaultSettings, defaultTaskPriority: 'low' }));
        const pending = deferred<void>();
        let calls = 0;
        const repository: SettingsRepository = {
            persistence: 'session', load: memory.load,
            async save(userId, record) {
                if (++calls === 1) await pending.promise;
                await memory.save(userId, record);
            }
        };
        const store = createSettingsStore(repository, 'anna');
        await store.load();
        store.updateSettings({ ...defaultSettings, themeMode: 'light' });
        store.resetSettings();
        equal(store.getSnapshot().settings, defaultSettings);
        pending.resolve();
        await store.whenIdle();
        equal(decodeSettings(await memory.load('anna')), defaultSettings);
        equal(decodeSettings(await memory.load('ben')).defaultTaskPriority, 'low');
    } },
    { name: 'Verspätete und abgebrochene Ladeantworten überschreiben keinen neueren Stand', async run() {
        const first = deferred<unknown>();
        const second = deferred<unknown>();
        let loads = 0;
        const repository: SettingsRepository = {
            persistence: 'account',
            load() { return ++loads === 1 ? first.promise : second.promise; },
            async save() {}
        };
        const store = createSettingsStore(repository, 'anna');
        const oldLoad = store.load();
        store.cancelPendingLoad();
        const newLoad = store.load();
        second.resolve(encodeSettings({ ...defaultSettings, themeMode: 'light' }));
        await newLoad;
        first.resolve(encodeSettings(defaultSettings));
        await oldLoad;
        equal(store.getSnapshot().settings.themeMode, 'light');
        equal(store.getSnapshot().status, 'ready');
    } },
    { name: 'Ein später Schreibabschluss für einen alten Benutzer verändert die Einstellungen des neuen Benutzers nicht', async run() {
        const memory = createSessionSettingsRepository();
        const pending = deferred<void>();
        const repository: SettingsRepository = {
            persistence: 'account', load: memory.load,
            async save(userId, record) {
                if (userId === 'anna') await pending.promise;
                await memory.save(userId, record);
            }
        };
        const anna = createSettingsStore(repository, 'anna');
        await anna.load();
        anna.updateSettings({ ...defaultSettings, themeMode: 'light' });
        anna.cancelPendingLoad();
        const ben = createSettingsStore(repository, 'ben');
        await ben.load();
        ben.updateSettings({ ...defaultSettings, defaultTaskPriority: 'high' });
        await ben.whenIdle();
        pending.resolve();
        await anna.whenIdle();
        equal(ben.getSnapshot().settings, { ...defaultSettings, defaultTaskPriority: 'high' });
        equal(decodeSettings(await memory.load('anna')).themeMode, 'light');
    } },
    { name: 'Ein Ladefehler lässt sich wiederholen, ohne zuvor Defaults über vorhandene Daten zu speichern', async run() {
        let fail = true;
        let saves = 0;
        const repository: SettingsRepository = {
            persistence: 'account',
            async load() { if (fail) throw new Error('offline'); return encodeSettings({ ...defaultSettings, themeMode: 'light' }); },
            async save() { saves++; }
        };
        const store = createSettingsStore(repository, 'anna');
        await store.load();
        equal(store.getSnapshot().error?.operation, 'load');
        store.resetSettings();
        equal(saves, 0);
        fail = false;
        const ready = deferred<void>();
        const unsubscribe = store.subscribe(() => { if (store.getSnapshot().status === 'ready') ready.resolve(); });
        store.retry();
        await ready.promise;
        unsubscribe();
        equal(store.getSnapshot().settings.themeMode, 'light');
        equal(saves, 0);
    } }
];

import { createWorkspaceStore } from './workspaceStore.js';
import { decodeWorkspace, emptyWorkspace } from './workspaceSchema.js';
import type { Workspace, WorkspaceRepository } from './workspaceTypes';

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const fixture = (): Workspace => ({ ...emptyWorkspace(), files: [] });
const ticks = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
export const workspaceTests = [
    { name: 'Zusammengehörige Änderungen werden als eine vollständige Transaktion gespeichert', async run() {
        const writes: Workspace[] = [];
        const repository: WorkspaceRepository = { persistence: 'account', async load() { return { data: fixture(), revision: '1' }; }, async save(data) { writes.push(data); return '2'; } };
        const store = createWorkspaceStore(repository); await store.load();
        store.update('customers', [{ id: 1, name: 'Kunde', street: '', city: '', country: '', email: '', phone: '', industry: '' }]);
        store.update('projects', [{ id: 1, customerId: 1, name: 'Projekt', deadline: '2026-12-31', planningCompleted: false }]);
        await ticks();
        assert(writes.length === 1 && writes[0].projects.length === 1 && writes[0].customers.length === 1, 'Verknüpfte Daten müssen zusammen gespeichert werden');
        assert(store.getSnapshot().status === 'ready', 'Speicherbestätigung muss sichtbar sein');
    } },
    { name: 'Änderungen während des Speicherns verwenden anschließend die bestätigte neue Revision', async run() {
        let finish: (revision: string) => void = () => {};
        const revisions: string[] = [];
        const repository: WorkspaceRepository = { persistence: 'account', async load() { return { data: fixture(), revision: '1' }; }, async save(_data, revision) {
            revisions.push(revision); return revisions.length === 1 ? new Promise<string>((resolve) => { finish = resolve; }) : '3';
        } };
        const store = createWorkspaceStore(repository); await store.load(); store.update('wiki', { articles: [], categories: [] }); await ticks();
        store.update('tasks', []); finish('2'); await ticks();
        assert(revisions.join(',') === '1,2' && store.getSnapshot().status === 'ready', 'Schreibvorgänge müssen geordnet mit neuen Revisionen laufen');
    } },
    { name: 'Speicherfehler behalten lokale Änderungen und können ohne Endlosschleife wiederholt werden', async run() {
        let calls = 0;
        const repository: WorkspaceRepository = { persistence: 'account', async load() { return { data: fixture(), revision: '1' }; }, async save() { if (++calls === 1) throw new Error('Offline'); return '2'; } };
        const store = createWorkspaceStore(repository); await store.load(); store.update('epics', []); await ticks();
        assert(store.getSnapshot().status === 'error' && store.getSnapshot().data, 'Lokale Daten müssen erhalten bleiben');
        assert(calls === 1, 'Kein automatisches Dauerschreiben bei Fehlern');
        store.retry(); await ticks(); assert(Number(calls) === 2 && store.getSnapshot().status === 'ready', 'Wiederholen muss funktionieren');
    } },
    { name: 'Versionskonflikte werden nicht durch erneutes Speichern fremder Änderungen übergangen', async run() {
        let calls = 0;
        const repository: WorkspaceRepository = { persistence: 'account', async load() { return { data: fixture(), revision: '1' }; }, async save() { calls++; throw { status: 409 }; } };
        const store = createWorkspaceStore(repository); await store.load(); store.update('sprints', []); await ticks(); store.retry(); await ticks();
        assert(store.getSnapshot().conflict && calls === 1, 'Konflikte benötigen einen neuen Serverstand');
    } },
    { name: 'Verspätete Ladeantworten und Speicherantworten ändern keinen neu geladenen Zustand', async run() {
        const finish: ((value: { data: Workspace; revision: string }) => void)[] = [];
        const repository: WorkspaceRepository = { persistence: 'account', load() { return new Promise((resolve) => finish.push(resolve)); }, async save() { return '3'; } };
        const store = createWorkspaceStore(repository); const first = store.load(); const second = store.load();
        const newest = fixture(); finish[1]({ data: newest, revision: '2' }); await second;
        finish[0]({ data: fixture(), revision: '1' }); await first;
        assert(store.getSnapshot().data === newest, 'Ältere Ladeantwort darf den Serverstand nicht überschreiben');
        store.dispose();
    } },
    { name: 'Workspace-Eingänge werden auf Version, Kennungen und Projektbeziehungen geprüft', run() {
        const data = emptyWorkspace();
        assert(decodeWorkspace({ version: 1, revision: '1', data }).data.projects.length === 0, 'Leere Konten müssen erlaubt sein');
        for (const record of [{ version: 2, revision: '1', data }, { version: 1, revision: '', data },
            { version: 1, revision: '1', data: { ...data, projects: [{ id: 1, customerId: 99, name: 'Fremd', planningCompleted: false, deadline: '2026-12-31' }] } }]) {
            let failed = false; try { decodeWorkspace(record); } catch { failed = true; } assert(failed, 'Ungültige Daten müssen abgewiesen werden');
        }
    } }
];

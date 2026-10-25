import { createWorkspaceStore } from './workspaceStore.js';
import { decodeWorkspace, emptyWorkspace } from './workspaceSchema.js';
import { decodeRecentActivity, recentActivityPath } from './recentActivity.js';
import type { Workspace, WorkspaceRepository } from './workspaceTypes';

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const fixture = (): Workspace => ({ ...emptyWorkspace(), files: [] });
const ticks = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
export const workspaceTests = [
    { name: 'Recent activity validates bounded targets and builds only internal object links', run() {
        const entry = { id: '00000000-0000-0000-0000-000000000001', kind: 'project', action: 'updated', entityId: 42, name: 'Project', at: '2026-10-25T10:00:00Z' };
        const decoded = decodeRecentActivity({ entries: [entry] }); assert(recentActivityPath(decoded[0]) === '/projectManager/projects?project=42', 'Project link must point to its object');
        assert(recentActivityPath({ ...decoded[0], kind: 'customer' }) === '/projectManager/customers?customer=42' && recentActivityPath({ ...decoded[0], kind: 'settings', entityId: null }) === '/projectManager/settings', 'History target routes missing');
        for (const entries of [Array(6).fill(entry), [entry, entry], [{ ...entry, kind: 'external' }], [{ ...entry, entityId: -1 }], [{ ...entry, at: 'invalid' }]]) {
            let failed = false; try { decodeRecentActivity({ entries }); } catch { failed = true; } assert(failed, 'Malformed history must not be accepted');
        }
    } },
    { name: 'Only confirmed saves enter dashboard history and failed changes can be discarded without a replay', async run() {
        let reject = false, writes = 0;
        const store = createWorkspaceStore({ persistence: 'account', async load() { return { data: fixture(), revision: '1' }; }, async save() { writes++; if (reject) throw new Error('Offline'); return '2'; } });
        await store.load(); const customer = { id: 1, name: 'Saved customer', street: '', city: '', country: '', email: '', phone: '', industry: '' };
        store.update('customers', [customer]); await ticks(); assert(store.getSnapshot().recentActivity.length === 1, 'Confirmed creation must enter history');
        reject = true; store.update('customers', [{ ...customer, name: 'Failed update' }]); await ticks();
        assert(store.getSnapshot().recentActivity.length === 1 && store.getSnapshot().recentActivity[0].name === 'Saved customer', 'Failed update must not enter history');
        store.discardUnsaved(); assert(store.getSnapshot().data!.customers[0].name === 'Saved customer' && store.getSnapshot().status === 'ready' && writes === 2, 'Discard restores last confirmed snapshot without a PUT'); store.dispose();
    } },
    { name: 'Alte Kunden erhalten leere Detailfelder; neue Kontakte und Notizen werden ohne Textinterpretation geladen', run() {
        const customer = { id: 1, name: 'Customer', street: '', city: '', country: '', email: '', phone: '', industry: '' };
        const base = { version: 1, revision: '1', data: { ...emptyWorkspace(), customers: [customer] } };
        const old = decodeWorkspace(base).data.customers[0]; assert(old.contacts?.length === 0 && old.notes === '', 'Fehlende Alt-Felder müssen lesbar bleiben');
        const contact = { id: 1, customerId: 1, name: 'Contact', role: 'Manager', email: 'contact@example.test', phone: '' };
        const next = decodeWorkspace({ ...base, data: { ...base.data, customers: [{ ...customer, contacts: [contact], notes: '  <script>Text 😀</script>\n' }] } }).data.customers[0];
        assert(next.contacts?.[0].role === 'Manager' && next.notes === '  <script>Text 😀</script>\n', 'Details müssen unverändert geladen werden');
    } },
    { name: 'Workspace-Validierung weist falsche Kundenbeziehungen und doppelte Kontaktkennungen zurück', run() {
        const contact = { id: 1, customerId: 1, name: 'Contact', role: '', email: '', phone: '' };
        const customer = { id: 1, name: 'Customer', street: '', city: '', country: '', email: '', phone: '', industry: '', contacts: [contact] };
        for (const customers of [[{ ...customer, contacts: [{ ...contact, customerId: 2 }] }], [customer, { ...customer, id: 2, contacts: [{ ...contact, customerId: 2 }] }]]) {
            let failed = false; try { decodeWorkspace({ version: 1, revision: '1', data: { ...emptyWorkspace(), customers } }); } catch { failed = true; }
            assert(failed, 'Kundenfremde oder doppelte Kontakte dürfen nicht geladen werden');
        }
    } },
    { name: 'Externe KI-Änderungen laden ohne Unmount neu und überschreiben keine währenddessen entstandenen lokalen Änderungen', async run() {
        let finish: (value: { data: Workspace; revision: string }) => void = () => {};
        let loads = 0; const revisions: string[] = [];
        const initial = fixture(); const external = { ...fixture(), customers: [{ id: 1, name: 'From assistant', street: '', city: '', country: '', email: '', phone: '', industry: '' }] };
        const store = createWorkspaceStore({ persistence: 'account', async load() { if (++loads === 1) return { data: initial, revision: '1' }; return new Promise(resolve => { finish = resolve; }); },
            async save(_data, revision) { revisions.push(revision); return '3'; } });
        await store.load(); const refreshing = store.refreshExternal();
        assert(store.getSnapshot().data === initial && store.getSnapshot().status === 'ready', 'Externe Aktualisierung darf bestehende Komponenten nicht aushängen');
        finish({ data: external, revision: '2' }); assert(await refreshing && store.getSnapshot().data === external, 'Bestätigte Daten müssen sichtbar werden');
        store.update('tasks', []); await ticks(); assert(revisions[0] === '2', 'Nachfolgende Schreibzugriffe brauchen die externe Revision');
        const racing = store.refreshExternal(); store.update('customers', [{ ...external.customers[0], name: 'Local edit' }]); await ticks();
        finish({ data: external, revision: '2' }); assert(!await racing && store.getSnapshot().data?.customers[0].name === 'Local edit', 'Verspätetes Nachladen darf lokale Eingaben nicht verwerfen');
        store.dispose();
    } },
    { name: 'Speicherhinweise entstehen erst nach Bestätigung aller Änderungen, nicht beim Laden', async run() {
        const finish: ((revision: string) => void)[] = [];
        const store = createWorkspaceStore({ persistence: 'account', async load() { return { data: fixture(), revision: '1' }; },
            save() { return new Promise((resolve) => finish.push(resolve)); } });
        await store.load();
        assert(store.getSnapshot().saveNotice === null, 'Laden darf keinen Speichererfolg melden');
        store.update('tasks', []); await ticks();
        store.update('epics', []); finish[0]('2'); await ticks();
        assert(store.getSnapshot().saveNotice === null, 'Ein Zwischenstand ist noch kein vollständiger Speichererfolg');
        finish[1]('3'); await ticks();
        const notice = store.getSnapshot().saveNotice;
        assert(notice?.kind === 'success', 'Alle bestätigten Änderungen lösen einen Speicherhinweis aus');
        store.update('sprints', []); await ticks();
        assert(store.getSnapshot().saveNotice === null, 'Neue Änderungen entfernen den überholten Erfolg');
        finish[2]('4'); await ticks();
        store.dismissSaveNotice(notice.id);
        assert(store.getSnapshot().saveNotice?.kind === 'success', 'Ein alter Timer darf keinen neueren Hinweis schließen');
        await store.load();
        assert(store.getSnapshot().saveNotice === null, 'Neuladen entfernt alte Hinweise und erzeugt keinen Speichererfolg');
        store.dispose();
    } },
    { name: 'Ein verspäteter Speicherabschluss nach Neuladen erzeugt keinen falschen Erfolgshinweis', async run() {
        let finish: (revision: string) => void = () => {};
        const store = createWorkspaceStore({ persistence: 'account', async load() { return { data: fixture(), revision: '1' }; },
            save() { return new Promise((resolve) => { finish = resolve; }); } });
        await store.load(); store.update('tasks', []); await ticks();
        await store.load(); finish('2'); await ticks();
        assert(store.getSnapshot().saveNotice === null && store.getSnapshot().status === 'ready', 'Veraltete Antwort darf keinen Speicherhinweis auslösen');
        store.dispose();
    } },
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

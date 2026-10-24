import { act, create } from 'react-test-renderer';
import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { ThemeProvider } from 'styled-components';
import { darkTheme } from '../../styles/theme';
import { LanguageContext } from '../../hooks/languageContext';
import { createChatStore } from '../../services/ai/chatStore';
import type { ChatRepository, ChatMessage } from '../../services/ai/chatRepository';
import { isWorkspaceMutation, sameCreation } from '../../services/ai/workspaceActions';
import type { WorkspaceMutation } from '../../services/ai/workspaceActions';
import { isProjectToolEvent } from '../../services/ai/projectTools';
import WorkspaceCreationCard from './WorkspaceCreationCard';
import ProjectToolResults from './ProjectToolResults';

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const text = (node: ReactTestInstance): string => node.children.map(child => typeof child === 'string' ? child : text(child)).join('');
const id = '11111111-1111-4111-8111-111111111111'; const now = '2026-10-24T00:00:00Z';
const proposal = (): WorkspaceMutation => ({ id, type: 'workspace.create', entity: 'customers', data: { id: 1, name: '<script>Customer Ü</script>', email: 'test@example.test' },
    revision: 'workspace-1', expiresAt: new Date(Date.now() + 300000).toISOString(), status: 'proposed', resultRevision: null });
async function fixture(updating = false) {
    let action: WorkspaceMutation = updating ? { ...proposal(), type: 'workspace.update', data: { id: 1, name: 'After' }, before: { name: 'Before' } } : proposal(), writes = 0, sends = 0, synced = 0;
    const messages = (): ChatMessage[] => [{ id, role: 'user', content: 'Create customer', createdAt: now }, { id, role: 'assistant', content: 'Please confirm', createdAt: now,
        tools: [{ id, name: updating ? 'propose_workspace_update' : 'propose_workspace_create', status: 'completed', result: { outcome: 'OK', revision: 'workspace-1', readAt: now, projects: [], tasks: [], total: 1, offset: 0, more: false, textTruncated: false, mutation: action } }] }];
    const repository: ChatRepository = { async create() { return { id, language: 'de', messages: [] }; }, async load() { return { id, language: 'de', messages: messages() }; }, async send() { sends++; }, async cancel() {},
        async createRecord(_id, value, _decisionId, decision) { writes++; action = { ...value, status: decision === 'approve' ? 'succeeded' : 'rejected', resultRevision: decision === 'approve' ? 'workspace-2' : null }; return action; } };
    const store = createChatStore(repository, () => id); await store.openConversation(id);
    return { store, repository, get writes() { return writes; }, get sends() { return sends; }, get synced() { return synced; },
        async sync() { synced++; return true; }, get action() { return action; } };
}
export const workspaceCreationTests = [
    { name: 'Änderungskarten zeigen vollständige alte und neue Werte und speichern erst nach Klick', async run() {
        const action: WorkspaceMutation = { ...proposal(), type: 'workspace.update', data: { id: 1, name: '<b>After</b>', city: '' }, before: { name: 'Before', city: 'Bonn' } };
        let decisions = 0; let renderer!: ReactTestRenderer;
        await act(async () => { renderer = create(<ThemeProvider theme={darkTheme}><LanguageContext.Provider value="en"><WorkspaceCreationCard action={action} busy={false} blocked={false} onDecision={() => { decisions++; }} /></LanguageContext.Provider></ThemeProvider>); });
        try {
            const content = text(renderer.root);
            assert(content.includes('Change proposal') && content.includes('Before: Before') && content.includes('After: <b>After</b>') && content.includes('Bonn'), 'Alte/neue Angaben müssen vollständig und übersetzt angezeigt werden');
            assert(decisions === 0 && renderer.root.findAllByType('b').length === 0 && renderer.root.findAllByType('input').length === 0, 'Weder HTML noch Passwortfeld oder automatische Aktion erlaubt');
            const button = renderer.root.findAllByType('button').find(node => text(node) === 'Confirm and update'); assert(button, 'Änderungsbestätigung fehlt');
            await act(async () => button.props.onClick()); assert(Number(decisions) === 1, 'Nur Klick darf bestätigen');
        } finally { await act(async () => renderer.unmount()); }
    } },
    { name: 'Änderungsvalidierung bindet Vorschau und unveränderliche Zielfelder an den passenden Werkzeugtyp', async run() {
        const action: WorkspaceMutation = { ...proposal(), type: 'workspace.update', data: { id: 1, name: 'After' }, before: { name: 'Before' } };
        assert(isWorkspaceMutation(action) && !isWorkspaceMutation({ ...action, before: {} }) && !isWorkspaceMutation({ ...action, before: null }), 'Änderungen benötigen passende Vorherwerte');
        assert(!isWorkspaceMutation({ ...action, data: { id: 1, ownerId: 'foreign' }, before: { ownerId: 'old' } }), 'Unbekannte Felder dürfen nicht geändert werden');
        assert(!isWorkspaceMutation({ ...action, entity: 'users' }) && !isWorkspaceMutation({ ...action, type: 'workspace.create' }), 'Kontoänderungen und gemischte Aktionen müssen scheitern');
        assert(!sameCreation(action, { ...action, before: { name: 'Tampered' } }), 'Ausgetauschte Vorherwerte müssen abgewiesen werden');
        const event = { id, name: 'propose_workspace_update', status: 'completed', result: { outcome: 'OK', revision: 'workspace-1', readAt: now, projects: [], tasks: [], total: 1, offset: 0, more: false, textTruncated: false, mutation: action } };
        assert(isProjectToolEvent(event) && !isProjectToolEvent({ ...event, name: 'propose_workspace_create' }), 'Werkzeug und Aktion müssen zusammenpassen');
    } },
    { name: 'Bestätigte Änderungen und verlorene Antworten werden einmal geschrieben und anschließend nur nachgelesen', async run() {
        const f = await fixture(true); const original = f.repository.createRecord!;
        f.repository.createRecord = async (...args) => { await original(...args); throw new Error('Lost update response'); };
        await f.store.decideCreation(id, 'approve', () => true, () => f.sync());
        await f.store.decideCreation(id, 'approve', () => true, () => f.sync());
        assert(f.writes === 1 && f.synced === 1 && f.sends === 0 && f.store.getSnapshot().messages[1].tools?.[0].result?.mutation?.before?.name === 'Before', 'Änderung muss einmal übernommen und ohne neues Modell nachgelesen werden');
        f.store.dispose();
    } },
    { name: 'Benutzeranlage verlangt ein privates Passwortfeld und löscht dessen Inhalt nach expliziter Übergabe', async run() {
        const action: WorkspaceMutation = { ...proposal(), entity: 'users', data: { id, name: 'New user', email: 'new@example.test', administrator: false, active: true } };
        let password: string | undefined; let renderer!: ReactTestRenderer;
        await act(async () => { renderer = create(<ThemeProvider theme={darkTheme}><LanguageContext.Provider value="en"><WorkspaceCreationCard action={action} busy={false} blocked={false} onDecision={(_decision, value) => { password = value; }} /></LanguageContext.Provider></ThemeProvider>); });
        try {
            const button = () => renderer.root.findAllByType('button').find(node => text(node) === 'Confirm and create')!;
            assert(button().props.disabled && renderer.root.findByType('input').props.type === 'password', 'Passwort darf nicht im Chat angefordert werden');
            await act(async () => renderer.root.findByType('input').props.onChange({ target: { value: 'Synthetic-only-password-123' } }));
            assert(!button().props.disabled && password === undefined, 'Eingabe allein darf keine Anfrage auslösen');
            await act(async () => button().props.onClick());
            assert(String(password) === 'Synthetic-only-password-123' && renderer.root.findByType('input').props.value === '', 'Passwort muss nach direkter Übergabe aus dem Feld entfernt werden');
            assert(!JSON.stringify(action).includes('Synthetic-only-password'), 'Öffentlicher Vorschlag darf kein Passwort enthalten');
        } finally { await act(async () => renderer.unmount()); }
    } },
    { name: 'Anlagekarten zeigen unveränderliche Daten sicher, übersetzt und ohne automatisches Speichern', async run() {
        let decisions = 0; let renderer!: ReactTestRenderer;
        await act(async () => { renderer = create(<ThemeProvider theme={darkTheme}><LanguageContext.Provider value="en"><WorkspaceCreationCard action={proposal()} busy={false} blocked={false} onDecision={() => { decisions++; }} /></LanguageContext.Provider></ThemeProvider>); });
        try {
            assert(text(renderer.root).includes('Not saved yet') && renderer.root.findAllByType('script').length === 0 && decisions === 0, 'Vorschlag muss reine sichere Anzeige bleiben');
            const button = renderer.root.findAllByType('button').find(node => text(node) === 'Confirm and create'); assert(button, 'Bestätigungsbutton fehlt');
            await act(async () => button.props.onClick()); assert(Number(decisions) === 1, 'Nur expliziter Klick darf entscheiden');
        } finally { await act(async () => renderer.unmount()); }
    } },
    { name: 'Zählabfragen und Anlageprotokoll validieren Bereiche, Kennungen und unveränderliche Nutzdaten', async run() {
        const action = proposal(); assert(isWorkspaceMutation(action), 'Gültige Anlagekarte fehlt');
        assert(!isWorkspaceMutation({ ...action, data: { ...action.data, ownerId: 'foreign' } }) && !isWorkspaceMutation({ ...action, entity: 'accounts' }), 'Unbekannte Rechte-/Bereichsfelder dürfen nicht akzeptiert werden');
        assert(sameCreation(action, { ...action, data: { email: 'test@example.test', name: '<script>Customer Ü</script>', id: 1 } }), 'Objektfeldreihenfolge verändert die Bedeutung nicht');
        assert(!sameCreation(action, { ...action, data: { ...action.data, name: 'Other' } }), 'Geänderte Nutzdaten dürfen nicht bestätigt werden');
        const event = { id, name: 'read_workspace', status: 'completed', result: { outcome: 'OK', revision: '1', readAt: now, projects: [], tasks: [], total: 42, offset: 0, more: false, textTruncated: false,
            workspace: { entity: 'customers', mode: 'count', textOffset: 0, items: [], message: null } } };
        assert(isProjectToolEvent(event) && !isProjectToolEvent({ ...event, result: { ...event.result, workspace: { ...event.result.workspace, entity: 'accounts' } } }), 'Geschlossene Zählbereiche fehlen');
        let renderer!: ReactTestRenderer;
        await act(async () => { renderer = create(<ThemeProvider theme={darkTheme}><LanguageContext.Provider value="en"><ProjectToolResults entries={[event as import('../../services/ai/projectTools').ProjectToolEvent]} /></LanguageContext.Provider></ThemeProvider>); });
        try { assert(text(renderer.root).includes('Found: 42') && !text(renderer.root).includes('No projects'), 'Kundenzahl muss als tatsächliche Anzahl erscheinen'); }
        finally { await act(async () => renderer.unmount()); }
    } },
    { name: 'Anlage wartet auf Freigabe, synchronisiert Erfolg und wiederholt einen bestätigten Schreibzugriff nicht', async run() {
        const f = await fixture(); assert(f.writes === 0 && f.sends === 0, 'Laden darf keinen Schreib-/Modellzugriff auslösen');
        await f.store.decideCreation(id, 'approve', () => false, () => f.sync()); assert(f.writes === 0, 'Offene Formulare müssen Anlage blockieren');
        await f.store.refresh(); await f.store.decideCreation(id, 'approve', () => true, () => f.sync());
        await f.store.decideCreation(id, 'approve', () => true, () => f.sync());
        assert(Number(f.writes) === 1 && f.synced === 1 && f.store.getSnapshot().messages[1].tools?.[0].result?.mutation?.status === 'succeeded', 'Erfolg muss synchronisiert und gegen Doppelklick geschützt sein'); f.store.dispose();
    } },
    { name: 'Verlorene Anlageantwort wird nur nachgelesen; verspätete Freigaben nach Logout verändern keine Ansicht', async run() {
        const f = await fixture(); const original = f.repository.createRecord!;
        f.repository.createRecord = async (...args) => { await original(...args); throw new Error('Lost response'); };
        await f.store.decideCreation(id, 'approve', () => true, () => f.sync());
        assert(f.writes === 1 && f.synced === 1 && f.store.getSnapshot().messages[1].tools?.[0].result?.mutation?.status === 'succeeded', 'Commit muss ohne erneuten POST wiedergefunden werden'); f.store.dispose();
        const pending = await fixture(); let release: () => void = () => {}; const createRecord = pending.repository.createRecord!;
        pending.repository.createRecord = async (...args) => { await new Promise<void>(resolve => { release = resolve; }); return createRecord(...args); };
        const deciding = pending.store.decideCreation(id, 'approve', () => true, () => pending.sync()); pending.store.dispose(); release(); await deciding;
        assert(pending.synced === 0, 'Eine alte Sitzung darf keinen neuen Workspace aktualisieren');
    } }
];

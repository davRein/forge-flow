import { createChatStore } from './chatStore.js';
import type { ChatConversation, ChatEvent, ChatMessage, ChatRepository } from './chatRepository.js';
import { ApiError } from '../api/apiClient.js';
import type { ProjectToolEvent } from './projectTools.js';
import { NavigationError } from './navigationActions.js';
import type { NavigationAction } from './navigationActions.js';

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const id = '11111111-1111-4111-8111-111111111111';
const user: ChatMessage = { id, role: 'user', content: 'Hallo', createdAt: '2026-10-23T10:00:00Z' };
const assistant: ChatMessage = { ...user, role: 'assistant', content: 'Grüße' };
function fixture() {
    let history: ChatConversation = { id, language: 'de', messages: [] };
    let receive: (event: ChatEvent) => void = () => {};
    let finish: () => void = () => {};
    let calls = 0, cancelled = 0;
    const repository: ChatRepository = {
        async create(language) { history = { ...history, language }; return history; },
        async load() { return history; },
        async cancel() { cancelled++; },
        async send(_id, _request, _text, signal, listener) {
            calls++; receive = listener;
            await new Promise<void>(resolve => { finish = resolve; signal.addEventListener('abort', () => resolve(), { once: true }); });
        }
    };
    const store = createChatStore(repository, () => id);
    return { store, repository, emit: (event: ChatEvent) => receive(event), finish: () => finish(), get calls() { return calls; }, get cancelled() { return cancelled; },
        commit() { history = { ...history, messages: [user, assistant] }; } };
}
async function tick() { await Promise.resolve(); await Promise.resolve(); }
async function actionFixture() {
    let action: NavigationAction = { id, type: 'project.view', projectId: 17, projectName: 'Alpha', projectTab: 'tasks', expiresAt: '2099-01-01T00:00:00Z', status: 'proposed', resultCode: null };
    const tool = (): ProjectToolEvent => ({ id, name: 'propose_project_navigation', status: 'completed', result: { outcome: 'OK', revision: '1', readAt: user.createdAt, projects: [], tasks: [], total: 1, offset: 0, more: false, textTruncated: false, action } });
    const messages = (): ChatMessage[] => [user, { ...assistant, tools: [tool()] }];
    let decisions = 0, reports = 0;
    const repository: ChatRepository = {
        async create() { return { id, language: 'de', messages: [] }; },
        async load() { return { id, language: 'de', messages: messages() }; }, async cancel() {},
        async send(_id, request, _text, _signal, receive) { receive({ kind: 'done', turn: { requestId: request, user, assistant: messages()[1], truncated: false } }); },
        async decide(_id, _action, _decisionId, decision) { decisions++; action = { ...action, status: decision === 'approve' ? 'approved' : 'rejected' }; return { action, executionId: decision === 'approve' ? id : null }; },
        async report(_id, _action, _execution, status, code) { reports++; action = { ...action, status, resultCode: code }; return action; }
    };
    const store = createChatStore(repository, () => id); store.setDraft('Hallo'); await store.send('de');
    return { store, repository, get decisions() { return decisions; }, get reports() { return reports; }, get action() { return action; } };
}
export const chatStoreTests = [
    { name: 'Gespeicherte Gespräche werden ohne Modellanfrage geöffnet und laufende fremde Ansichten bleiben gesperrt', async run() {
        let sends = 0, busy = true, deleted = 0;
        const repository: ChatRepository = {
            async create() { return { id, language: 'de', messages: [] }; }, async load() { return { id, language: 'en', messages: [user, assistant], busy }; }, async cancel() {},
            async send() { sends++; }, async remove() { deleted++; },
            async list() { return { storage: 'postgresql', retentionSeconds: 2592000, items: [] }; }, async executions() { return []; }
        };
        const store = createChatStore(repository, () => id);
        assert(await store.openConversation(id), 'Gespeicherter Verlauf muss sich öffnen lassen');
        assert(store.getSnapshot().messages.length === 2 && store.getSnapshot().conversationLanguage === 'en' && store.getSnapshot().remoteBusy, 'Laufstatus und Sprache fehlen');
        store.setDraft('Hallo'); await store.send('de'); assert(sends === 0, 'Aktiver Lauf einer anderen Ansicht darf nicht erneut gesendet werden');
        busy = false; await store.refresh(); assert(!store.getSnapshot().remoteBusy, 'Nachladen muss den abgeschlossenen Lauf erkennen');
        await store.list(new AbortController().signal); await store.executions(id, new AbortController().signal);
        assert(sends === 0, 'Verwaltung darf keine Provider-Anfrage starten');
        assert(await store.deleteConversation(id, new AbortController().signal) && deleted === 1 && store.getSnapshot().conversationId === null && store.getSnapshot().messages.length === 0, 'Löschen muss die aktuelle Ansicht entfernen'); store.dispose();
    } },
    { name: 'Veraltete und fehlgeschlagene Gesprächsantworten ersetzen keinen bestehenden Verlauf', async run() {
        const f = fixture(); f.store.setDraft('Hallo'); const sending = f.store.send('de'); await tick();
        f.emit({ kind: 'done', turn: { requestId: id, user, assistant, truncated: false } }); f.finish(); await sending;
        f.repository.load = async () => { throw new ApiError(404, 'AI_CONVERSATION_NOT_FOUND', 'Not found'); };
        assert(!await f.store.openConversation(id) && f.store.getSnapshot().messages.length === 2, 'Ladefehler muss die bisherige Ansicht erhalten');
        let release: () => void = () => {};
        f.repository.load = async () => { await new Promise<void>(resolve => { release = resolve; }); return { id, language: 'de', messages: [] }; };
        const opening = f.store.openConversation(id); f.store.dispose(); release(); await opening;
        assert(f.store.getSnapshot().messages.length === 2, 'Späte Antworten nach Accountwechsel dürfen die Ansicht nicht verändern');
    } },
    { name: 'Mehrstufige Chatläufe erhalten geordnete Ergebnisse und übernehmen sie erst beim vollständigen Abschluss', async run() {
        const f = fixture(); f.store.setDraft('Hallo'); const sending = f.store.send('de'); await tick();
        const one: ProjectToolEvent = { id, name: 'list_projects', status: 'completed', result: { outcome: 'OK', revision: '1', readAt: user.createdAt,
            projects: [], tasks: [], total: 0, offset: 0, more: false, textTruncated: false } };
        const two: ProjectToolEvent = { ...one, id: '22222222-2222-4222-8222-222222222222', name: 'list_open_tasks' };
        f.emit({ kind: 'execution', execution: { phase: 'thinking', step: 0, maxSteps: 4 } });
        for (const [index, tool] of [one, two].entries()) {
            f.emit({ kind: 'execution', execution: { phase: 'reading', step: index + 1, maxSteps: 4 } });
            f.emit({ kind: 'tool', tool: { ...tool, status: 'started', result: null } });
            assert(f.store.getSnapshot().pending?.tools.length === index + 1 && f.store.getSnapshot().messages.length === 0, 'Schritte müssen geordnet und unbestätigt bleiben');
            f.emit({ kind: 'tool', tool });
            f.emit({ kind: 'execution', execution: { phase: 'thinking', step: index + 1, maxSteps: 4 } });
        }
        f.emit({ kind: 'done', turn: { requestId: id, user, assistant: { ...assistant, tools: [one, two] }, truncated: false } }); f.finish(); await sending;
        assert(f.store.getSnapshot().messages[1].tools?.map(tool => tool.id).join() === [one.id, two.id].join(), 'Alle bestätigten Quellen müssen erhalten bleiben'); f.store.dispose();
    } },
    { name: 'Überlappende Schritte, veränderte Grenzen und unvollständige Abschlüsse werden ohne Wiederholung verworfen', async run() {
        const start: ProjectToolEvent = { id, name: 'list_projects', status: 'started', result: null };
        for (const events of [
            [{ kind: 'tool', tool: start }, { kind: 'tool', tool: { ...start, id: '22222222-2222-4222-8222-222222222222' } }],
            [{ kind: 'execution', execution: { phase: 'thinking', step: 0, maxSteps: 4 } }, { kind: 'execution', execution: { phase: 'reading', step: 1, maxSteps: 5 } }],
            [{ kind: 'tool', tool: start }, { kind: 'done', turn: { requestId: id, user, assistant, truncated: false } }]
        ] as ChatEvent[][]) {
            let calls = 0;
            const repository: ChatRepository = { async create() { return { id, language: 'de', messages: [] }; }, async load() { return { id, language: 'de', messages: [] }; }, async cancel() {},
                async send(_id, _request, _text, _signal, receive) { calls++; events.forEach(receive); } };
            const store = createChatStore(repository, () => id); store.setDraft('Hallo'); await store.send('de');
            assert(store.getSnapshot().messages.length === 0 && store.getSnapshot().pending === null && store.getSnapshot().draft === 'Hallo'
                && store.getSnapshot().noticeKind === 'error' && calls === 1, 'Ungültige Folge muss vollständig verworfen werden und Eingabe behalten'); store.dispose();
        }
    } },
    { name: 'Abbruch im zweiten Werkzeugschritt verwirft auch bereits gelesene unbestätigte Ergebnisse', async run() {
        const f = fixture(); f.store.setDraft('Hallo'); const sending = f.store.send('de'); await tick();
        const first: ProjectToolEvent = { id, name: 'list_projects', status: 'completed', result: { outcome: 'OK', revision: '1', readAt: user.createdAt, projects: [], tasks: [], total: 0, offset: 0, more: false, textTruncated: false } };
        f.emit({ kind: 'tool', tool: { ...first, status: 'started', result: null } }); f.emit({ kind: 'tool', tool: first });
        f.emit({ kind: 'tool', tool: { id: '22222222-2222-4222-8222-222222222222', name: 'list_open_tasks', status: 'started', result: null } });
        await f.store.stop(); f.finish(); await sending;
        assert(f.store.getSnapshot().messages.length === 0 && f.store.getSnapshot().pending === null && f.store.getSnapshot().draft === 'Hallo' && f.cancelled === 1, 'Teilfolge darf weder übernommen noch fortgesetzt werden'); f.store.dispose();
    } },
    { name: 'Aktionskarten führen weder beim Laden noch Ablehnen aus und bestätigen explizite Navigation genau einmal', async run() {
        const rejected = await actionFixture(); let executions = 0;
        const execute = async () => { executions++; };
        await rejected.store.refresh(); assert(rejected.decisions === 0 && executions === 0, 'Lesen darf keine Freigabe auslösen');
        await rejected.store.decide(id, 'reject', execute);
        assert(rejected.action.status === 'rejected' && rejected.reports === 0 && executions === 0, 'Ablehnen darf nicht navigieren');
        const approved = await actionFixture(); let release: () => void = () => {};
        const running = approved.store.decide(id, 'approve', async () => { executions++; await new Promise<void>(resolve => { release = resolve; }); });
        await tick();
        await approved.store.decide(id, 'approve', execute);
        approved.store.newConversation(); approved.store.setDraft('Hallo'); await approved.store.send('de');
        assert(approved.decisions === 1 && Number(executions) === 1 && approved.store.getSnapshot().actionBusy === id, 'Doppelklick/Parallelaktionen müssen blockiert sein');
        release(); await running;
        assert(approved.action.status === 'succeeded' && approved.reports === 1 && approved.store.getSnapshot().actionBusy === null, 'Bestätigtes UI-Ergebnis fehlt');
        await approved.store.refresh(); await approved.store.decide(id, 'approve', execute);
        assert(approved.decisions === 1 && Number(executions) === 1, 'Historie darf Navigation niemals wiederholen');
        rejected.store.dispose(); approved.store.dispose();
    } },
    { name: 'Ungewisse Freigaben, ausgetauschte Ziele und veraltete Sitzungen navigieren nicht', async run() {
        for (const mode of ['lost', 'mismatch', 'disposed']) {
            const f = await actionFixture(); const original = f.repository.decide!; let executions = 0;
            f.repository.decide = async (...args) => {
                const result = await original(...args);
                if (mode === 'lost') throw new Error('connection lost');
                if (mode === 'disposed') f.store.dispose();
                return { ...result, action: { ...result.action, projectId: 42 } };
            };
            await f.store.decide(id, 'approve', async () => { executions++; });
            assert(executions === 0 && f.reports === 0, 'Fehlende/ungültige Freigabe darf keine UI-Aktion auslösen');
            if (mode !== 'disposed') { assert(!!f.store.getSnapshot().actionErrors[id], 'Unklarer Status muss sichtbar sein'); await f.store.refresh(); }
            assert(executions === 0, 'Wiederladen darf nicht ausführen'); f.store.dispose();
        }
    } },
    { name: 'Blockierte Navigation meldet einen begrenzten Fehlercode und Ausfall der Ergebnisbestätigung führt nicht erneut aus', async run() {
        const f = await actionFixture();
        await f.store.decide(id, 'approve', async () => { throw new NavigationError('UNSAVED_CHANGES'); });
        assert(f.action.status === 'failed' && f.action.resultCode === 'UNSAVED_CHANGES', 'Formularschutz muss an den Chat zurückgemeldet werden'); f.store.dispose();
        const uncertain = await actionFixture(); let executions = 0;
        uncertain.repository.report = async () => { throw new Error('lost result'); };
        await uncertain.store.decide(id, 'approve', async () => { executions++; });
        await uncertain.store.refresh(); await uncertain.store.decide(id, 'approve', async () => { executions++; });
        assert(executions === 1 && uncertain.store.getSnapshot().messages[1].tools?.[0].result?.action?.status === 'approved', 'Unbestätigte Ausführung muss unklar bleiben und darf nicht wiederholt werden'); uncertain.store.dispose();
    } },
    { name: 'Abgelaufene Aktionskarten und Abmeldung während der Freigabe lösen keine Navigation aus', async run() {
        const expired = await actionFixture(); let executions = 0;
        expired.repository.load = async () => ({ id, language: 'de', messages: expired.store.getSnapshot().messages.map(message => ({ ...message,
            tools: message.tools?.map(tool => ({ ...tool, result: tool.result && { ...tool.result, action: tool.result.action && { ...tool.result.action, expiresAt: '2000-01-01T00:00:00Z' } } })) })) });
        await expired.store.refresh(); await expired.store.decide(id, 'approve', async () => { executions++; });
        assert(expired.decisions === 0 && executions === 0 && expired.store.getSnapshot().messages[1].tools?.[0].result?.action?.status === 'expired', 'Abgelaufene Karte muss lokal und serverseitig gesperrt sein'); expired.store.dispose();
        const pending = await actionFixture(); let release: () => void = () => {};
        const original = pending.repository.decide!;
        pending.repository.decide = async (...args) => { await new Promise<void>(resolve => { release = resolve; }); return original(...args); };
        const deciding = pending.store.decide(id, 'approve', async () => { executions++; });
        pending.store.dispose(); release(); await deciding;
        assert(executions === 0 && pending.reports === 0, 'Abgemeldeter Browser darf eine späte Freigabe nicht ausführen');
    } },
    { name: 'Chat friert den Seitenbezug vor dem asynchronen Gesprächsstart ein', async run() {
        let finishCreate: () => void = () => {};
        let sent: unknown;
        const repository: ChatRepository = {
            async create() { await new Promise<void>(resolve => { finishCreate = resolve; }); return { id, language: 'de', messages: [] }; },
            async load() { return { id, language: 'de', messages: [] }; }, async cancel() {},
            async send(_id, request, text, _signal, receive, context) {
                sent = context;
                receive({ kind: 'done', turn: { requestId: request, user: { ...user, content: text, context }, assistant, truncated: false } });
            }
        };
        const store = createChatStore(repository, () => id);
        const page = { route: '/projectManager/projects', projectId: 17, projectTab: 'tasks' as const };
        store.setDraft('Welche Aufgaben sind hier offen?'); const sending = store.send('de', page);
        page.projectId = 42; finishCreate(); await sending;
        assert((sent as typeof page).projectId === 17 && store.getSnapshot().messages[0].context?.projectId === 17, 'Während des Sendens darf der Seitenwechsel den Kontext nicht verändern');
        store.dispose();
    } },
    { name: 'Chat zeigt Werkzeugfortschritt und erhält bestätigte Quellen nach einem erfolgreichen Abschluss', async run() {
        const f = fixture(); f.store.setDraft('Hallo'); const sending = f.store.send('de'); await tick();
        const started: ProjectToolEvent = { id, name: 'list_projects', status: 'started', result: null };
        const done: ProjectToolEvent = { ...started, status: 'completed', result: { outcome: 'OK', revision: '1', readAt: '2026-10-23T12:00:00Z', projects: [], tasks: [], total: 0, offset: 0, more: false, textTruncated: false } };
        f.emit({ kind: 'tool', tool: started });
        assert(f.store.getSnapshot().pending?.tools[0].status === 'started', 'Lesender Zugriff muss sichtbar werden');
        f.emit({ kind: 'tool', tool: done }); f.emit({ kind: 'delta', text: 'Keine Projekte.' });
        assert(f.store.getSnapshot().pending?.tools[0].status === 'completed', 'Textabschnitte dürfen Werkzeugdaten nicht verwerfen');
        f.emit({ kind: 'done', turn: { requestId: id, user, assistant: { ...assistant, tools: [done] }, truncated: false } });
        f.finish(); await sending;
        assert(f.store.getSnapshot().messages[1].tools?.[0].result?.revision === '1', 'Bestätigte Quellen müssen Teil des Nachrichtenverlaufs bleiben');
        f.store.dispose();
    } },
    { name: 'Abgebrochene Werkzeugzugriffe und späte Ergebnisse werden nicht in den Verlauf übernommen', async run() {
        const f = fixture(); f.store.setDraft('Hallo'); const sending = f.store.send('de'); await tick();
        f.emit({ kind: 'tool', tool: { id, name: 'list_projects', status: 'started', result: null } });
        await f.store.stop();
        f.emit({ kind: 'tool', tool: { id, name: 'list_projects', status: 'completed', result: null } }); f.finish(); await sending;
        assert(f.store.getSnapshot().pending === null && f.store.getSnapshot().messages.length === 0, 'Abbruch muss auch Werkzeugdaten verwerfen');
        f.store.dispose();
    } },
    { name: 'Chat wartet auf explizites Senden und übernimmt erst eine bestätigte vollständige Antwort', async run() {
        const f = fixture(); assert(f.calls === 0, 'Öffnen darf keine bezahlte Anfrage auslösen');
        f.store.setDraft('Hallo'); const sending = f.store.send('en'); await tick();
        f.emit({ kind: 'delta', text: 'Grü' });
        assert(f.store.getSnapshot().messages.length === 0 && f.store.getSnapshot().pending?.partial === 'Grü', 'Teilantwort muss unbestätigt bleiben');
        f.emit({ kind: 'done', turn: { requestId: id, user, assistant, truncated: true } }); f.finish(); await sending;
        const state = f.store.getSnapshot();
        assert(state.messages.length === 2 && state.draft === '' && state.truncated && state.conversationLanguage === 'en', 'Bestätigter Verlauf/Sprachwahl fehlen');
        f.store.dispose();
    } },
    { name: 'Chat verhindert parallele Sendungen und verwirft späte Ereignisse nach Stoppen', async run() {
        const f = fixture(); f.store.setDraft('Hallo'); const sending = f.store.send('de'); await tick();
        await f.store.send('de'); f.emit({ kind: 'delta', text: 'Teil' });
        await f.store.stop();
        f.emit({ kind: 'done', turn: { requestId: id, user, assistant, truncated: false } }); f.finish(); await sending;
        assert(f.calls === 1 && f.cancelled === 1, 'Stoppen muss dieselbe Anfrage abbrechen, keine weitere erzeugen');
        assert(f.store.getSnapshot().messages.length === 0 && f.store.getSnapshot().draft === 'Hallo' && f.store.getSnapshot().status === 'idle', 'Abbruch darf keine Teilantwort hinterlassen');
        f.store.dispose();
    } },
    { name: 'Chat lädt bei einem Abbruchrennen eine bereits bestätigte Antwort nach', async run() {
        const f = fixture(); f.store.setDraft('Hallo'); const sending = f.store.send('de'); await tick();
        f.commit(); await f.store.stop(); f.finish(); await sending;
        assert(f.store.getSnapshot().messages.length === 2 && f.store.getSnapshot().draft === '' && f.store.getSnapshot().notice?.includes('bereits abgeschlossen'), 'Bereits gespeicherte Antwort muss erhalten bleiben');
        f.store.dispose();
    } },
    { name: 'Stoppen direkt nach done darf eine bestätigte Antwort nicht wieder zum Entwurf machen', async run() {
        const f = fixture(); f.store.setDraft('Hallo'); const sending = f.store.send('de'); await tick();
        f.emit({ kind: 'done', turn: { requestId: id, user, assistant, truncated: false } });
        await f.store.stop(); f.finish(); await sending;
        assert(f.store.getSnapshot().messages.length === 2 && f.store.getSnapshot().draft === '' && f.cancelled === 0, 'Bereits bestätigte Antwort darf nicht nachträglich abgebrochen werden');
        f.store.dispose();
    } },
    { name: 'Chat erhält den Entwurf bei Anbieterfehlern und startet keine automatische Wiederholung', async run() {
        const f = fixture(); let calls = 0;
        f.repository.send = async () => { calls++; throw new ApiError(503, 'AI_QUOTA_EXCEEDED', 'Guthaben fehlt'); };
        f.store.setDraft('Hallo'); await f.store.send('de');
        assert(calls === 1 && f.store.getSnapshot().draft === 'Hallo' && f.store.getSnapshot().notice === 'Guthaben fehlt', 'Fehler oder Entwurf fehlen');
        f.store.dispose();
    } },
    { name: 'Chat stellt nach Streamverlust bestätigten Verlauf ohne neue Modellanfrage wieder her', async run() {
        const f = fixture(); f.repository.send = async () => { f.commit(); throw new ApiError(502, 'AI_STREAM_INTERRUPTED', 'Verbindung verloren'); };
        f.store.setDraft('Hallo'); await f.store.send('de');
        assert(f.store.getSnapshot().messages.length === 2 && f.store.getSnapshot().draft === '', 'Bestätigte Antwort muss nachgeladen werden');
        f.store.newConversation(); assert(f.store.getSnapshot().messages.length === 0, 'Neue Unterhaltung darf alten Verlauf nicht übernehmen');
        f.store.dispose();
    } },
    { name: 'Entfernen des Chat-Stores beendet den Transport und ignoriert spätere Kontodaten', async run() {
        const f = fixture(); f.store.setDraft('Hallo'); const sending = f.store.send('de'); await tick();
        f.store.dispose(); const oldState = f.store.getSnapshot();
        f.emit({ kind: 'delta', text: 'späte private Antwort' }); f.finish(); await sending;
        assert(f.cancelled === 1 && f.store.getSnapshot() === oldState, 'Entfernter Benutzerzustand darf nicht weiter aktualisiert werden');
    } }
];

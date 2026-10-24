import { createElement } from 'react';
import { act, create } from 'react-test-renderer';
import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { ThemeProvider } from 'styled-components';
import ChatWidget from './ChatWidget';
import { createChatStore } from '../../services/ai/chatStore';
import type { ChatEvent, ChatRepository } from '../../services/ai/chatRepository';
import { LanguageContext } from '../../hooks/languageContext';
import { darkTheme } from '../../styles/theme';

const id = '11111111-1111-4111-8111-111111111111';
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const text = (node: ReactTestInstance): string => node.children.map(child => typeof child === 'string' ? child : text(child)).join('');
async function fixture(language: 'de' | 'en' = 'de') {
    let calls = 0, cancellations = 0;
    let receive: (event: ChatEvent) => void = () => {};
    let finish: () => void = () => {};
    const repository: ChatRepository = {
        async create(value) { return { id, language: value, messages: [] }; },
        async load() { return { id, language: 'de', messages: [] }; },
        async cancel() { cancellations++; },
        async send(_id, _request, _message, signal, listener) {
            calls++; receive = listener;
            await new Promise<void>(resolve => { finish = resolve; signal.addEventListener('abort', () => resolve(), { once: true }); });
        }
    };
    const store = createChatStore(repository, () => id);
    let renderer!: ReactTestRenderer;
    await act(async () => { renderer = create(createElement(ThemeProvider, { theme: darkTheme },
        createElement(LanguageContext.Provider, { value: language }, createElement(ChatWidget, { store })))); });
    return { store, get root() { return renderer.root; }, get calls() { return calls; }, get cancellations() { return cancellations; },
        button(label: string) {
            const button = renderer.root.findAllByType('button').find(node => node.props['aria-label'] === label || text(node).trim() === label);
            assert(button, `Button ${label} fehlt`); return button;
        },
        async click(label: string) { await act(async () => this.button(label).props.onClick()); },
        async type(value: string) { await act(async () => renderer.root.findByType('textarea').props.onChange({ target: { value } })); },
        async send() { await act(async () => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} })); },
        async emit(event: ChatEvent) { await act(async () => { receive(event); }); },
        async finish() { await act(async () => finish()); },
        async close() { await act(async () => renderer.unmount()); }
    };
}
export const chatWidgetTests = [
    { name: 'Chat-Widget zeigt übersetzten Mehrschrittfortschritt und behält nummerierte Quellen nach Abschluss', async run() {
        const f = await fixture('en');
        try {
            await f.click('Open AI assistant'); await f.type('Find Alpha and read its tasks'); await f.send();
            const first = { id, name: 'list_projects' as const, status: 'completed' as const, result: { outcome: 'OK' as const, revision: '1', readAt: '2026-10-23T12:00:00Z', projects: [], tasks: [], total: 0, offset: 0, more: false, textTruncated: false } };
            const second = { ...first, id: '22222222-2222-4222-8222-222222222222', name: 'list_open_tasks' as const };
            for (const [index, tool] of [first, second].entries()) {
                await f.emit({ kind: 'execution', execution: { phase: 'reading', step: index + 1, maxSteps: 4 } });
                await f.emit({ kind: 'tool', tool: { ...tool, status: 'started', result: null } });
                assert(text(f.root).includes(`Tool steps: ${index + 1} of at most 4`) && text(f.root).includes('Reading data …'), 'Übersetzter Fortschritt fehlt');
                await f.emit({ kind: 'tool', tool });
            }
            await f.emit({ kind: 'execution', execution: { phase: 'answering', step: 2, maxSteps: 4 } });
            assert(text(f.root).includes('Summarizing the answer …'), 'Zusammenfassungsstatus fehlt');
            await f.emit({ kind: 'done', turn: { requestId: id, truncated: false,
                user: { id, role: 'user', content: 'Find Alpha and read its tasks', createdAt: first.result.readAt },
                assistant: { id: '33333333-3333-4333-8333-333333333333', role: 'assistant', content: 'Result', createdAt: first.result.readAt, tools: [first, second] } } });
            await f.finish();
            const summaries = f.root.findAllByType('summary').map(text);
            assert(summaries.length === 2 && summaries[0].includes('1. Read project overview') && summaries[1].includes('2. Read open tasks'), 'Bestätigte Schritte müssen sichtbar und geordnet bleiben');
        } finally { await f.close(); }
    } },
    { name: 'Navigationsvorschläge sind erst nach vollständig bestätigter Chatantwort als Aktionskarten sichtbar', async run() {
        const f = await fixture('en');
        try {
            await f.click('Open AI assistant'); await f.type('Open Alpha tasks'); await f.send();
            const event = { id, name: 'propose_project_navigation' as const, status: 'completed' as const, result: {
                outcome: 'OK' as const, revision: '1', readAt: '2026-10-23T12:00:00Z', projects: [], tasks: [], total: 1, offset: 0, more: false, textTruncated: false,
                action: { id, type: 'project.view' as const, projectId: 17, projectName: '<script>Alpha</script>', projectTab: 'tasks' as const, expiresAt: '2099-01-01T00:00:00Z', status: 'proposed' as const, resultCode: null }
            } };
            await f.emit({ kind: 'tool', tool: { ...event, status: 'started', result: null } });
            await f.emit({ kind: 'tool', tool: event });
            assert(!text(f.root).includes('Confirm and open'), 'Unbestätigte Toolereignisse dürfen keine ausführbaren Aktionskarten erzeugen');
            await f.emit({ kind: 'done', turn: { requestId: id, truncated: false,
                user: { id, role: 'user', content: 'Open Alpha tasks', createdAt: '2026-10-23T12:00:00Z' },
                assistant: { id: '22222222-2222-4222-8222-222222222222', role: 'assistant', content: 'Please confirm.', createdAt: '2026-10-23T12:00:00Z', tools: [event] } } });
            await f.finish();
            assert(text(f.root).includes('Navigation proposal') && text(f.root).includes('Task list') && text(f.root).includes('Project data will not change'), 'Übersetzte Vorschau und Umfang fehlen');
            assert(f.button('Confirm and open').props.disabled && !f.button('Reject').props.disabled, 'Ohne registrierte Navigation darf nur Ablehnen möglich sein');
            assert(f.root.findAllByType('script').length === 0, 'Aktionsziel muss als Text gerendert werden');
        } finally { await f.close(); }
    } },
    { name: 'Chat-Widget zeigt lesende Werkzeuge, gespeicherte Quellen und ungefilterten Text ohne HTML-Ausführung', async run() {
        const f = await fixture('en');
        try {
            await f.click('Open AI assistant'); await f.type('Hello'); await f.send();
            const started = { id, name: 'get_project_summary' as const, status: 'started' as const, result: null };
            await f.emit({ kind: 'tool', tool: started });
            assert(text(f.root).includes('Read project status · Reading …'), 'Werkzeugfortschritt muss sichtbar sein');
            const completed = { ...started, status: 'completed' as const, result: { outcome: 'OK' as const, revision: '1', readAt: '2026-10-23T12:00:00Z',
                projects: [{ id: 1, name: '<script>project</script>', planningCompleted: true, deadline: '2026-12-31', tasks: { todo: 2, inProgress: 1, done: 3 } }],
                tasks: [], total: 1, offset: 0, more: false, textTruncated: false } };
            await f.emit({ kind: 'tool', tool: completed });
            await f.emit({ kind: 'done', turn: { requestId: id, truncated: false,
                user: { id, role: 'user', content: 'Hello', createdAt: '2026-10-23T12:00:00Z' },
                assistant: { id: '22222222-2222-4222-8222-222222222222', role: 'assistant', content: 'Summary', createdAt: '2026-10-23T12:00:00Z', tools: [completed] } } });
            await f.finish();
            const content = text(f.root);
            assert(content.includes('Saved data · retrieved') && content.includes('Planning complete') && content.includes('Tasks: 2 to do · 1 in progress · 3 done'), 'Übersetzte Quellen und Kennzahlen fehlen');
            assert(f.root.findAllByType('details').length === 1 && f.root.findAllByType('script').length === 0, 'Quellen müssen aufklappbar sein und Projektnamen als Text behandeln');
            assert(content.includes('requested workspace data are shared with OpenAI') && content.includes('Do not enter passwords or keys in the chat'), 'Datenweitergabe muss verständlich bleiben');
        } finally { await f.close(); }
    } },
    { name: 'Chat-Widget öffnet ohne Modellaufruf und behält Text sowie laufende Antwort beim Schließen', async run() {
        const f = await fixture();
        try {
            await f.click('KI-Assistent öffnen'); await f.type('Hallo');
            await f.click('Chat schließen'); await f.click('KI-Assistent öffnen');
            assert(f.root.findByType('textarea').props.value === 'Hallo' && f.calls === 0, 'Schließen muss den Entwurf erhalten');
            await f.send(); await f.emit({ kind: 'delta', text: 'Grüße <script>kein HTML</script>' });
            assert(text(f.root).includes('Grüße <script>kein HTML</script>') && f.root.findAllByType('script').length === 0, 'Modelltext darf kein HTML ausführen');
            await f.click('Chat schließen'); assert(f.cancellations === 0, 'Schließen ist kein Abbruch');
            await f.click('KI-Assistent öffnen'); assert(text(f.root).includes('Grüße'), 'Teilantwort muss beim Wiederöffnen sichtbar sein');
            await f.click('Stoppen'); await f.finish();
            assert(Number(f.cancellations) === 1 && f.root.findByType('textarea').props.value === 'Hallo', 'Stoppen muss abbrechen und Entwurf erhalten');
        } finally { await f.close(); }
    } },
    { name: 'Chat-Widget verwendet englische Texte und verlangt vor dem Verwerfen eines Verlaufs eine Bestätigung', async run() {
        const f = await fixture('en');
        try {
            await f.click('Open AI assistant'); assert(text(f.root).includes('How can I help?'), 'Englische Einführung fehlt');
            await f.type('Hello'); await f.send();
            await f.emit({ kind: 'done', turn: { requestId: id, truncated: false,
                user: { id, role: 'user', content: 'Hello', createdAt: '2026-10-23T10:00:00Z' },
                assistant: { id: '22222222-2222-4222-8222-222222222222', role: 'assistant', content: 'Hi', createdAt: '2026-10-23T10:00:00Z' } } });
            await f.finish(); await f.click('New conversation');
            assert(text(f.root).includes('Start a new conversation?') && f.store.getSnapshot().messages.length === 2, 'Verlauf darf nicht sofort verschwinden');
            const confirm = f.root.findAllByType('button').find(node => !node.props['aria-label'] && text(node) === 'New conversation');
            assert(confirm, 'Bestätigung fehlt'); await act(async () => confirm.props.onClick());
            assert(f.store.getSnapshot().messages.length === 0 && f.calls === 1, 'Neue Unterhaltung darf keinen Modellaufruf starten');
        } finally { await f.close(); }
    } },
    { name: 'Chat-Widget bleibt nach Reacts Effect-Neustart bedienbar', async run() {
        const f = await fixture();
        try {
            // React StrictMode runs effect cleanup/setup again during development.
            f.store.dispose(); f.store.connect();
            await f.click('KI-Assistent öffnen'); await f.type('Hallo');
            assert(f.store.getSnapshot().draft === 'Hallo', 'Effect-Neustart darf den Store nicht dauerhaft deaktivieren');
        } finally { await f.close(); }
    } }
];

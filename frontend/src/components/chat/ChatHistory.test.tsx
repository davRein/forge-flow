import { act, create } from 'react-test-renderer';
import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { ThemeProvider } from 'styled-components';
import { darkTheme } from '../../styles/theme';
import { LanguageContext } from '../../hooks/languageContext';
import { createChatStore } from '../../services/ai/chatStore';
import type { ChatRepository } from '../../services/ai/chatRepository';
import ChatHistory from './ChatHistory';

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const text = (node: ReactTestInstance): string => node.children.map(child => typeof child === 'string' ? child : text(child)).join('');
const id = '11111111-1111-4111-8111-111111111111'; const now = '2026-10-23T12:00:00Z';
export const chatHistoryTests = [
    { name: 'Gesprächsliste erklärt Persistenz, schützt Entwürfe und verlangt explizites Löschen ohne Modellaufruf', async run() {
        let removed = 0, loaded = 0, sent = 0, closed = 0;
        const repository: ChatRepository = {
            async create() { return { id, language: 'de', messages: [] }; }, async load() { loaded++; return { id, language: 'en', messages: [] }; }, async cancel() {}, async send() { sent++; },
            async remove() { removed++; }, async executions() { return [{ id, requestId: id, status: 'interrupted', startedAt: now, finishedAt: now, errorCode: 'AI_RUN_INTERRUPTED', steps: [] }]; },
            async list() { return { storage: 'postgresql', retentionSeconds: 2592000, items: removed ? [] : [{ id, language: 'en', title: '<script>Test chat</script>', createdAt: now, updatedAt: now, messageCount: 2, busy: false }] }; }
        };
        const store = createChatStore(repository); store.setDraft('Unsent test-only draft');
        let renderer!: ReactTestRenderer;
        await act(async () => { renderer = create(<ThemeProvider theme={darkTheme}><LanguageContext.Provider value="en"><ChatHistory store={store} busy={false} onClose={() => { closed++; }} /></LanguageContext.Provider></ThemeProvider>); });
        const button = (label: string) => { const found = renderer.root.findAllByType('button').find(node => text(node) === label); assert(found, `Button ${label} fehlt`); return found; };
        try {
            assert(text(renderer.root).includes('Stored in PostgreSQL') && renderer.root.findAllByType('script').length === 0 && sent === 0, 'Persistenzhinweis oder sichere Titel fehlen');
            await act(async () => button('Open conversation').props.onClick());
            assert(loaded === 0 && text(renderer.root).includes('The unsent draft will be discarded'), 'Entwurf muss vor dem Wechsel geschützt werden');
            await act(async () => button('Cancel').props.onClick());
            await act(async () => button('Execution history').props.onClick());
            assert(text(renderer.root).includes('Interrupted') && text(renderer.root).includes('AI_RUN_INTERRUPTED'), 'Ausführungsstatus fehlt');
            await act(async () => button('Delete').props.onClick());
            assert(removed === 0 && text(renderer.root).includes('Permanently delete'), 'Löschen muss ausdrücklich bestätigt werden');
            await act(async () => button('Delete permanently').props.onClick());
            assert(Number(removed) === 1 && text(renderer.root).includes('No conversations yet.') && sent === 0 && closed === 0, 'Löschen darf keine Modellanfrage oder automatische Navigation auslösen');
        } finally { await act(async () => renderer.unmount()); store.dispose(); }
    } }
];

import { act, create } from 'react-test-renderer';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { darkTheme } from '../../styles/theme';
import { showcaseProjects, showcaseAccess } from '../../config/showcaseProjects';
import ShowcasePage from './ShowcasePage';
import { LanguageContext } from '../../hooks/languageContext';

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }

export const showcasePageTests = [{ name: 'Restricted showcase modules require an administrator; standalone local mode remains available', run() {
    assert(showcaseAccess(true, true), 'Administrators may use the protected modules');
    assert(!showcaseAccess(false, true) && !showcaseAccess(undefined, true), 'Regular and missing accounts must not see protected frames');
    assert(showcaseAccess(false, false) && showcaseAccess(undefined, false), 'Unrestricted local mode remains available');
} }, { name: 'Embedded module accepts navigation only from its configured frame and preserves the frame while inactive', async run() {
    const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const listeners = new Set<(event: MessageEvent) => void>();
    const messages: { type: string; section?: string; language?: string }[] = [];
    const child = { postMessage(message: { type: string; section?: string; language?: string }) { messages.push(message); } };
    let path = '';
    Object.defineProperty(globalThis, 'window', { configurable: true, value: {
        setTimeout() { return 1; }, clearTimeout() {},
        location: { hash: '#/knowledgeHub/documents' },
        addEventListener(_type: string, callback: (event: MessageEvent) => void) { listeners.add(callback); },
        removeEventListener(_type: string, callback: (event: MessageEvent) => void) { listeners.delete(callback); }
    } });
    function Host({ active }: { active: boolean }) {
        path = useLocation().pathname;
        return <ShowcasePage app="knowledgeHub" section="documents" active={active} />;
    }
    const tree = (active: boolean, language: 'de' | 'en' | 'fr' = 'en') => <ThemeProvider theme={darkTheme}><LanguageContext.Provider value={language}><MemoryRouter><Host active={active} /></MemoryRouter></LanguageContext.Provider></ThemeProvider>;
    const renderer = create(tree(true), { createNodeMock(element) { return element.type === 'iframe' ? { contentWindow: child } : {}; } });
    const project = showcaseProjects.find(project => project.key === 'knowledgeHub')!;
    const receive = async (origin: string, source: unknown, type: string, section = 'chat') => act(async () => {
        for (const callback of listeners) callback({ origin, source, data: { channel: 'forgeflow-suite', type, section } } as MessageEvent);
    });
    try {
        await act(async () => {});
        const frame = renderer.root.findByType('iframe');
        assert(frame.props.hidden, 'Frame should await its handshake');
        await receive('https://wrong.example', child, 'ready');
        assert(renderer.root.findByType('iframe').props.hidden, 'Untrusted origin accepted');
        await receive(new URL(project.url!).origin, {}, 'ready');
        assert(renderer.root.findByType('iframe').props.hidden, 'Wrong source accepted');
        await receive(new URL(project.url!).origin, child, 'ready');
        assert(!renderer.root.findByType('iframe').props.hidden && messages.some(message => message.type === 'navigate' && message.section === 'documents'), 'Ready app must receive requested route');
        await act(async () => renderer.update(tree(true, 'de')));
        assert(messages.some(message => message.type === 'language' && message.language === 'de'), 'App must receive the active suite language');
        assert(renderer.root.findByType('iframe').props.src === frame.props.src, 'Language changes must not reload the frame');
        messages.length = 0;
        await act(async () => renderer.update(tree(true, 'fr')));
        assert(messages.some(message => message.type === 'language' && message.language === 'en'), 'Embedded apps need an explicit English fallback for French');
        assert(renderer.root.findByType('iframe').props.src === frame.props.src, 'French fallback must retain the frame');
        await receive(new URL(project.url!).origin, child, 'route', 'unknown');
        assert(path === '/', 'Unknown routes must be ignored');
        await receive(new URL(project.url!).origin, child, 'route', 'privacy');
        assert(String(path) === '/knowledgeHub/privacy', 'Inner app navigation must synchronize suite route');
        window.location.hash = '#/flowPilot/workflows';
        await receive(new URL(project.url!).origin, child, 'route', 'chat');
        assert(String(path) === '/knowledgeHub/privacy', 'A late message must not undo a module switch before React commits');
        await act(async () => renderer.update(tree(false)));
        assert(renderer.root.findByType('iframe').props.src === frame.props.src, 'Module switching must retain frame state');
    } finally {
        await act(async () => renderer.unmount());
        if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow); else Reflect.deleteProperty(globalThis, 'window');
    }
} }];

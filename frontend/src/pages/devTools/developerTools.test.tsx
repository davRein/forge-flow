import { useState } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { DeveloperContext, type DeveloperContextValue } from '../../hooks/developerContext';
import { AuthContext } from '../../hooks/authContext';
import { LanguageContext } from '../../hooks/languageContext';
import { createAuthStore } from '../../services/auth/authStore';
import { createApiClient } from '../../services/api/apiClient';
import { emptyDeveloper, type Snippet } from '../../services/developer/developer';
import { darkTheme } from '../../styles/theme';
import NavigationGuardProvider from '../../components/navigation/NavigationGuardProvider';
import { GuardedLink } from '../../components/navigation/GuardedLink';
import SnippetWorkbench from './components/SnippetWorkbench';
import GitPage from './GitPage';
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const text = (node: ReactTestInstance): string => node.children.map(item => typeof item === 'string' ? item : text(item)).join('');
const visible = (node: ReactTestInstance): boolean => !node.props.hidden && (!node.parent || visible(node.parent));
async function fixture(kind: 'snippet' | 'sql' | 'git') {
    const auth = createAuthStore(createApiClient('/api/v1'), false); const calls: { path: string; body: unknown }[] = [];
    let route = ''; let stored: Snippet[] = [];
    function Host() {
        route = useLocation().pathname; const [data, setData] = useState(() => ({ ...emptyDeveloper(), integrationsConfigured: true,
            connections: [{ id: 'connection-1', name: 'Test DB', host: 'localhost', port: 5432, database: 'test', username: 'reader', sslMode: 'require', hasPassword: true }],
            githubConnected: kind === 'git', githubLogin: 'test-user' }));
        const value: DeveloperContextValue = { data, remote: true, busy: false, error: '', status: 'ready', async load() {},
            async request<T>(path: string, body: unknown) {
                calls.push({ path, body }); let result: unknown = {};
                if (path === '/generate') result = { code: kind === 'sql' ? 'SELECT 42;' : 'const value = "<script>";', truncated: false };
                if (path.endsWith('/prepare')) result = { ticket: 'ticket-1', sql: (body as { sql: string }).sql, readOnly: true, target: { name: 'Test DB', host: 'localhost', port: 5432, database: 'test', username: 'reader' }, expiresAt: new Date(Date.now() + 120000).toISOString() };
                if (path.endsWith('/execute')) result = [{ columns: ['value'], rows: [['<script>alert(1)</script>']], affected: -1, truncated: false }];
                if (path.startsWith('/github/repositories?')) result = { page: path.endsWith('2') ? 2 : 1, hasMore: !path.endsWith('2'), items: [{ id: 1, name: 'test/repo', privateRepo: true, description: 'Sample repository', size: 1, url: 'https://github.com/test/repo' }] };
                if (path.endsWith('/clone')) setData(before => ({ ...before, clones: [{ repositoryId: 1, name: 'test/repo', path: '/private/test/1', status: 'ready', at: new Date().toISOString() }] }));
                return result as T;
            },
            async saveSnippet(input) { const saved: Snippet = { ...input, id: input.id ?? 'snippet-1', updatedAt: new Date().toISOString() }; stored = [saved]; setData(before => ({ ...before, snippets: stored })); return saved; },
            async deleteSnippet() { stored = []; setData(before => ({ ...before, snippets: [] })); }
        };
        return <DeveloperContext.Provider value={value}>{kind === 'git' ? <GitPage active={route === '/editor'} /> : <SnippetWorkbench sql={kind === 'sql'} active={route === '/editor'} />}<GuardedLink to="/other">Other page</GuardedLink></DeveloperContext.Provider>;
    }
    let renderer!: ReactTestRenderer;
    await act(async () => { renderer = create(<ThemeProvider theme={darkTheme}><LanguageContext.Provider value="en"><AuthContext.Provider value={auth}><MemoryRouter initialEntries={['/editor']}><NavigationGuardProvider><Host /></NavigationGuardProvider></MemoryRouter></AuthContext.Provider></LanguageContext.Provider></ThemeProvider>, { createNodeMock() { return { showModal() {}, close() {}, focus() {} }; } }); });
    const nodes = (type: string) => renderer.root.findAll(node => node.type === type).filter(visible);
    return { calls, get route() { return route; }, get stored() { return stored; }, nodes,
        async field(label: string, value: string, type = 'input') { const control = nodes('label').find(node => text(node).startsWith(label))?.findAll(node => node.type === type)[0]; assert(control, `Missing field ${label}`); await act(async () => { control.props.onChange({ target: { value } }); }); },
        async click(label: string) { const button = nodes('button').find(node => text(node) === label); assert(button && !button.props.disabled, `Missing enabled button ${label}`); await act(async () => { await button.props.onClick(); }); },
        async leave() { const link = nodes('a').find(node => text(node) === 'Other page')!; await act(async () => { link.props.onClick({ button: 0, preventDefault() { this.defaultPrevented = true; }, defaultPrevented: false }); }); },
        async submit() { await act(async () => { nodes('form')[0].props.onSubmit({ preventDefault() {} }); }); },
        async close() { await act(async () => { renderer.unmount(); }); auth.dispose(); }
    };
}
export const developerToolsTests = [
    { name: 'Snippeter generates without auto-save and guards drafts until explicit save or discard', async run() {
        const ui = await fixture('snippet'); try {
            await ui.field('Title', 'Useful snippet'); await ui.field('AI instructions', 'Write a typed value', 'textarea');
            await ui.click('Generate with AI'); assert(ui.stored.length === 0, 'Generation must not implicitly save');
            assert(ui.nodes('code').some(node => text(node).includes('<script>')), 'Generated code must appear as text');
            await ui.leave(); assert(ui.route === '/editor' && ui.nodes('dialog').length === 1, 'Unsaved code must block navigation');
            await ui.click('Stay on this page'); await ui.submit(); assert(ui.stored[0]?.code.includes('<script>') && ui.stored[0].language === 'typescript', 'Explicit save must persist source and language');
            await ui.leave(); assert(String(ui.route) === '/other', 'Saved draft must not block navigation');
        } finally { await ui.close(); }
    } },
    { name: 'SQL requires exact target and text confirmation and never executes when cancelled', async run() {
        const ui = await fixture('sql'); try {
            await ui.field('Database connection', 'connection-1', 'select'); await ui.field('Source code', 'SELECT 42;', 'textarea');
            await ui.click('Review execution …'); assert(ui.calls.length === 1 && ui.calls[0].path.endsWith('/prepare'), 'Review must not execute SQL');
            assert(text(ui.nodes('dialog')[0]).includes('reader@localhost:5432/test') && text(ui.nodes('dialog')[0]).includes('SELECT 42;'), 'Confirmation must show exact target and SQL');
            await ui.click('Cancel'); assert(ui.calls.length === 1, 'Cancel must not execute');
            await ui.click('Review execution …'); await ui.click('Execute now');
            const execution = ui.calls.find(call => call.path.endsWith('/execute')); assert(JSON.stringify(execution?.body) === '{"ticket":"ticket-1"}', 'Execution must send only immutable ticket');
            assert(ui.nodes('td').some(node => text(node).includes('<script>alert(1)</script>')), 'Result must render as safe text');
            await ui.leave(); await ui.click('Discard changes and continue'); assert(ui.route === '/other', 'SQL draft must participate in navigation guard');
        } finally { await ui.close(); }
    } },
    { name: 'Git lists repositories only on request, paginates and requires explicit clone confirmation', async run() {
        const ui = await fixture('git'); try {
            assert(ui.calls.length === 0 && ui.nodes('input')[0].props.type === 'password', 'Tokens must be private and loading manual');
            await ui.click('Load repositories'); await ui.click('Next'); assert(ui.calls[1].path.endsWith('page=2'), 'Accessible repositories must paginate');
            await ui.click('Clone'); assert(!ui.calls.some(call => call.path.endsWith('/clone')), 'Opening confirmation must not clone');
            await ui.click('Cancel'); assert(!ui.calls.some(call => call.path.endsWith('/clone')), 'Cancel must not clone');
            await ui.click('Clone'); await ui.click('Clone now'); assert(ui.calls.filter(call => call.path.endsWith('/clone')).length === 1 && ui.nodes('code').some(node => text(node) === '/private/test/1'), 'Confirmed clone must show private server location');
        } finally { await ui.close(); }
    } }
];

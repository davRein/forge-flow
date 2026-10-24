import { act, create } from 'react-test-renderer';
import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { LanguageContext } from '../../hooks/languageContext';
import { WorkspaceContext } from '../../hooks/workspaceContext';
import { createWorkspaceStore } from '../../services/workspace/workspaceStore';
import { decodeWorkspace, emptyWorkspace } from '../../services/workspace/workspaceSchema';
import { isWorkspaceMutation } from '../../services/ai/workspaceActions';
import { darkTheme } from '../../styles/theme';
import type { WikiData } from './types/wiki.types';
import { removeWikiArticle, removeWikiCategory, saveWikiArticle, wikiAncestors, wikiDescendants, wikiHierarchyError } from './utils/wikiLogic';
import { parseInlineMarkdown, parseMarkdown } from './utils/markdown';
import { useWiki } from './hooks/useWiki';
import WikiPage from './WikiPage';

const now = '2026-10-24T10:00:00Z';
function data(): WikiData { return { categories: [{ id: 1, name: 'Engineering', description: 'Technical knowledge', createdAt: now, updatedAt: now }, { id: 2, name: 'Operations', description: '', createdAt: now, updatedAt: now }],
    articles: [{ id: 9, title: 'Architecture', content: '# Overview\n\nText\n\n## Details\n\n**Bold** and <script>text</script>', categoryId: 1, parentId: null, createdAt: now, updatedAt: now },
        { id: 1, title: 'Deployment', content: '# Runbook\n\nChild text', categoryId: 1, parentId: 9, createdAt: now, updatedAt: now },
        { id: 3, title: 'Operations page', content: 'Other space content', categoryId: 2, parentId: null, createdAt: now, updatedAt: now }] }; }
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const text = (node: ReactTestInstance): string => node.children.map(child => typeof child === 'string' ? child : text(child)).join('');

async function fixture(route = '/wiki/articles?article=9', hookOnly = false) {
    const store = createWorkspaceStore({ persistence: 'account', async load() { return { data: { ...emptyWorkspace(), wiki: data(), files: [] }, revision: '1' }; }, async save() { return '2'; } });
    await store.load(); let renderer!: ReactTestRenderer; let url = ''; let wiki!: ReturnType<typeof useWiki>;
    function Host() { const location = useLocation(); url = location.pathname + location.search; wiki = useWiki();
        return hookOnly ? null : <WikiPage section={location.pathname.split('/')[2]} />; }
    await act(async () => { renderer = create(<ThemeProvider theme={darkTheme}><LanguageContext.Provider value="en"><WorkspaceContext.Provider value={store}><MemoryRouter initialEntries={[route]}><Host /></MemoryRouter></WorkspaceContext.Provider></LanguageContext.Provider></ThemeProvider>,
        { createNodeMock() { return { showModal() {}, close() {}, focus() {}, setSelectionRange() {} }; } }); });
    return { get root() { return renderer.root; }, get wiki() { return wiki; }, get url() { return url; }, store,
        async button(label: string) { const found = renderer.root.findAllByType('button').find(node => text(node) === label); assert(found, `Missing ${label}`); await act(async () => found.props.onClick()); },
        async link(href: string) { const found = renderer.root.findAllByType('a').find(node => node.props.href === href); assert(found, `Missing ${href}`); await act(async () => found.props.onClick({ button: 0, defaultPrevented: false, preventDefault() {}, metaKey: false, altKey: false, ctrlKey: false, shiftKey: false })); },
        async close() { await act(async () => renderer.unmount()); store.dispose(); } };
}

export const documentationTests = [
    { name: 'Dokumentationshierarchie erlaubt gleiche Bereiche und weist Schleifen, fremde Eltern und mehr als zwölf Ebenen ab', run() {
        const wiki = data(); assert(wikiHierarchyError(wiki.articles) === null, 'Valid hierarchy rejected');
        assert(wikiAncestors(wiki.articles, 1).map(page => page.id).join(',') === '9,1', 'Breadcrumb order wrong');
        assert(wikiDescendants(wiki.articles, 9).has(1), 'Child missing');
        for (const parent of [1, 3, 999]) assert(wikiHierarchyError(wiki.articles.map(page => page.id === 9 ? { ...page, parentId: parent } : page)), 'Invalid parent accepted');
        const chain = Array.from({ length: 13 }, (_, index) => ({ ...wiki.articles[0], id: index + 1, parentId: index === 0 ? null : index }));
        assert(wikiHierarchyError(chain.slice(0, 12)) === null && wikiHierarchyError(chain), 'Depth limit missing');
    } },
    { name: 'Seiten werden nicht mit Unterseiten gelöscht und Bereichswechsel erhält die Hierarchie bei Bereichslöschung', run() {
        const wiki = data(); assert(removeWikiArticle(wiki, 9).error, 'Parent must not be silently deleted');
        const detached = saveWikiArticle(wiki, { title: 'Deployment', content: 'Text', categoryId: 1, parentId: null }, 1, 10, now);
        assert(!detached.error && !removeWikiArticle(detached.data, 9).error, 'Explicit root move must allow parent deletion');
        const moved = removeWikiCategory(wiki, 1, 2, now); assert(!moved.error && moved.data.articles[1].parentId === 9 && moved.data.articles[1].categoryId === 2, 'Deleting space must preserve page hierarchy and text');
        assert(saveWikiArticle(wiki, { title: 'Architecture', content: 'Text', categoryId: 2, parentId: null }, 9, 10, now).error, 'Cross-space parent must be rejected');
        assert(wiki.articles[1].parentId === 9 && wiki.categories.length === 2, 'Source must remain immutable');
    } },
    { name: 'API-Decoder ergänzt alte Seiten und lehnt ungültige Hierarchien ab', run() {
        const wiki = data(); const legacy = { ...wiki.articles[2] }; delete legacy.parentId;
        const envelope = { version: 1, revision: '1', data: { ...emptyWorkspace(), wiki: { ...wiki, articles: [...wiki.articles.slice(0, 2), legacy] } } };
        assert(decodeWorkspace(envelope).data.wiki.articles[2].parentId === null, 'Legacy root must remain readable');
        for (const parentId of [1, 3, 999, -1]) {
            let rejected = false; try { decodeWorkspace({ ...envelope, data: { ...envelope.data, wiki: { ...wiki, articles: wiki.articles.map(page => page.id === 9 ? { ...page, parentId } : page) } } }); } catch { rejected = true; }
            assert(rejected, 'Invalid hierarchy must not reach UI');
        }
    } },
    { name: 'Formatierter Markdown rendert Tabellen und Hinweise, aber keine ausführbaren HTML- oder JavaScript-Links', run() {
        const blocks = parseMarkdown('> Note\n> second line\n\n---\n\n| Name | Value |\n| --- | --- |\n| **Safe** | `x` |');
        assert(blocks[0].type === 'quote' && blocks[1].type === 'divider' && blocks[2].type === 'table', 'Rich blocks missing');
        const inline = parseInlineMarkdown('**Bold** *Italic* `code` [Docs](https://example.test) [No](javascript:alert) <script>');
        assert(inline.some(part => part.type === 'strong') && inline.some(part => part.type === 'emphasis') && inline.some(part => part.type === 'code'), 'Formatting missing');
        assert(inline.filter(part => part.type === 'link').length === 1 && inline.some(part => part.type === 'text' && part.text.includes('<script>')), 'Unsafe markup must remain text');
    } },
    { name: 'Seitenbaum, Breadcrumbs, Inhaltsverzeichnis und bisherige Direktlinks öffnen passende Seiten', async run() {
        const ui = await fixture(); try {
            assert(text(ui.root).includes('On this page') && text(ui.root).includes('Child pages') && ui.root.findAllByType('strong').some(node => text(node) === 'Bold'), 'Reader layout missing');
            assert(ui.root.findAllByType('script').length === 0, 'Raw HTML must remain text');
            const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document'); let scrolled = '';
            try {
                Object.defineProperty(globalThis, 'document', { configurable: true, value: { getElementById(id: string) { return { scrollIntoView() { scrolled = id; } }; } } });
                await ui.button('Overview'); assert(scrolled === 'wiki-9-0' && ui.url.endsWith('article=9'), 'Table of contents must scroll without changing the hash route');
            } finally { if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument); else Reflect.deleteProperty(globalThis, 'document'); }
            const nav = ui.root.findAllByType('nav').find(node => node.props['aria-label'] === 'Page tree'); assert(nav && text(nav).includes('Deployment') && !text(nav).includes('Operations page'), 'Tree must be scoped to current space');
            const collapse = ui.root.findAllByType('button').find(node => node.props['aria-label'] === 'Collapse child pages: Architecture'); assert(collapse, 'Collapse control missing');
            await act(async () => collapse.props.onClick()); assert(!text(nav).includes('Deployment'), 'Tree must collapse');
            await ui.link('/wiki/articles?article=1');
            assert(ui.url.endsWith('article=1') && ui.root.findAllByType('nav').some(node => node.props['aria-label'] === 'Breadcrumbs' && text(node).includes('Architecture')), 'Legacy direct link must have parent breadcrumb');
        } finally { await ui.close(); }
    } },
    { name: 'Unterseiteneditor übernimmt Bereich und Elternseite; Vorlagen, Vorschau und Speichern erhalten den Text', async run() {
        const ui = await fixture('/wiki/articles?edit=new&parent=9'); try {
            const form = () => ui.root.findByType('form');
            assert(form().findAllByType('select').some(node => node.props.value === 9), 'Parent must be preselected');
            await ui.button('How-to guide');
            let source = form().findByType('textarea').props.value as string; assert(source.includes('# Goal') && source.includes('## Step by step'), 'Localized template missing');
            await ui.button('Table'); source = form().findByType('textarea').props.value as string; assert(source.includes('| Column 1 | Column 2 |'), 'Formatting toolbar must insert valid localized Markdown');
            await act(async () => form().findByType('input').props.onChange({ target: { value: 'New child' } }));
            await ui.button('Preview'); assert(ui.root.findAllByType('h2').some(node => text(node) === 'Goal'), 'Template preview missing');
            await ui.button('Edit content'); assert(form().findByType('textarea').props.value === source, 'Preview must not alter source');
            await act(async () => form().props.onSubmit({ preventDefault() {} }));
            const saved = ui.store.getSnapshot().data!.wiki.articles.find(page => page.title === 'New child'); assert(saved?.parentId === 9 && saved.categoryId === 1 && saved.content === source && saved.id === 10, 'Child page must persist with inherited space and unique ID');
        } finally { await ui.close(); }
    } },
    { name: 'Externe Änderungen überschreiben keinen Wiki-Entwurf und neue IDs berücksichtigen KI-Anlagen', async run() {
        const ui = await fixture('/wiki/home', true); try {
            await act(async () => ui.wiki.changeArticleDraft(1, { ...ui.wiki.getArticleDraft(1), title: 'Unsaved' }));
            await act(async () => ui.store.update('wiki', { ...ui.wiki.data, articles: ui.wiki.data.articles.map(page => page.id === 1 ? { ...page, content: 'External update' } : page) }));
            assert(ui.wiki.saveArticle(1).error && ui.wiki.drafts['1'].title === 'Unsaved', 'Stale draft must be retained without overwrite');
            await act(async () => ui.wiki.discardArticleDraft(1));
            await act(async () => ui.store.update('wiki', { ...ui.wiki.data, articles: [...ui.wiki.data.articles, { ...ui.wiki.data.articles[0], id: 100, title: 'Created by AI' }] }));
            await act(async () => ui.wiki.changeArticleDraft(null, { title: 'New', content: 'Text', categoryId: null, parentId: null }));
            await act(async () => { ui.wiki.saveArticle(null); }); assert(ui.wiki.data.articles.some(page => page.id === 101 && page.title === 'New'), 'External IDs must not collide');
        } finally { await ui.close(); }
    } },
    { name: 'KI-Vorschaukarten akzeptieren bestätigte Elternänderung, aber keine beliebigen Felder', run() {
        const action = { id: '11111111-1111-4111-8111-111111111111', type: 'workspace.update', entity: 'articles', data: { id: 1, parentId: null }, before: { parentId: 9 }, revision: '1', expiresAt: '2099-01-01T00:00:00Z', status: 'proposed', resultRevision: null };
        assert(isWorkspaceMutation(action) && !isWorkspaceMutation({ ...action, data: { ...action.data, ownerId: 'other' } }), 'Parent allowlist must stay bounded');
    } }
];

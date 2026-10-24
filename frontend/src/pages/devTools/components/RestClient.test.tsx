import { act, create } from 'react-test-renderer';
import type { ElementType } from 'react';
import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { ThemeProvider } from 'styled-components';
import RestCollectionsProvider from '../../../components/RestCollectionsProvider';
import { LanguageContext } from '../../../hooks/languageContext';
import { createSessionRestCollectionsRepository } from '../../../services/rest/restCollections';
import type { RestCollectionsRepository } from '../../../services/rest/restCollections';
import { darkTheme } from '../../../styles/theme';
import RestClient from './RestClient';
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const text = (node: ReactTestInstance): string => node.children.map(child => typeof child === 'string' ? child : text(child)).join('');
const visible = (node: ReactTestInstance): boolean => !node.props.hidden && (!node.parent || visible(node.parent));
async function fixture(repository = createSessionRestCollectionsRepository(), active = true) {
    let renderer!: ReactTestRenderer;
    const view = (selected: boolean) => <ThemeProvider theme={darkTheme}><LanguageContext.Provider value="en"><RestCollectionsProvider repository={repository}><RestClient active={selected} /></RestCollectionsProvider></LanguageContext.Provider></ThemeProvider>;
    await act(async () => { renderer = create(view(active), { createNodeMock() { return { showModal() {}, close() {}, focus() {} }; } }); });
    const nodes = (type: ElementType) => renderer.root.findAllByType(type).filter(visible);
    return { get root() { return renderer.root; }, nodes,
        async click(label: string) { const node = nodes('button').find(node => node.props['aria-label'] === label || text(node) === label); assert(node && !node.props.disabled, `Missing or disabled button: ${label}`); await act(async () => { await node.props.onClick(); }); },
        async change(node: ReactTestInstance, value: string) { await act(async () => { node.props.onChange({ target: { value } }); }); },
        async submit() { const dialog = nodes('dialog')[0]; assert(dialog, 'Dialog missing'); await act(async () => { dialog.findByType('form').props.onSubmit({ preventDefault() {} }); }); },
        async active(value: boolean) { await act(async () => { renderer.update(view(value)); }); },
        async close() { await act(async () => { renderer.unmount(); }); }
    };
}
export const restClientTests = [
    { name: 'Saved REST requests can be updated, copied, renamed and restored after remount', async run() {
        const repository = createSessionRestCollectionsRepository(); let ui = await fixture(repository);
        try {
            await ui.click('Create collection'); await ui.change(ui.nodes('dialog')[0].findByType('input'), 'Original'); await ui.submit();
            await ui.change(ui.nodes('input').find(node => node.props.type === 'url')!, 'https://example.test/first');
            await ui.click('Save'); await ui.change(ui.nodes('dialog')[0].findByType('input'), 'First'); await ui.submit();
            await ui.change(ui.nodes('input').find(node => node.props.type === 'url')!, 'https://example.test/updated');
            await ui.click('Save'); await ui.submit();
            let saved = await repository.load(new AbortController().signal); assert(saved.collections[0].requests.length === 1 && saved.collections[0].requests[0].draft.url.endsWith('/updated'), 'Save updates the loaded request in place');
            await ui.click('Save as…'); await ui.change(ui.nodes('dialog')[0].findByType('input'), 'Copy'); await ui.submit();
            await ui.click('Rename collection: Original'); await ui.change(ui.nodes('dialog')[0].findByType('input'), 'Renamed'); await ui.submit();
            saved = await repository.load(new AbortController().signal); assert(saved.collections[0].name === 'Renamed' && saved.collections[0].requests.length === 2 && saved.collections[0].requests[0].id !== saved.collections[0].requests[1].id, 'Copy creates a fresh request ID; rename preserves both');
            await ui.close(); ui = await fixture(repository); await ui.click('GETCopy');
            assert(ui.nodes('input').find(node => node.props.type === 'url')!.props.value.endsWith('/updated'), 'Saved request must restore after remount');
        } finally { await ui.close(); }
    } },
    { name: 'REST saves complete private drafts, reloads them without sending and confirms destructive changes', async run() {
        const original = globalThis.fetch; let sent = 0; globalThis.fetch = async () => { sent++; return new Response('ok'); };
        const repository = createSessionRestCollectionsRepository(); const ui = await fixture(repository);
        try {
            await ui.change(ui.nodes('select')[0], 'POST'); await ui.change(ui.nodes('input').find(node => node.props.type === 'url')!, 'https://example.test/api');
            await ui.change(ui.nodes('textarea')[0], 'X-Test: synthetic-marker'); await ui.click('Request body'); await ui.change(ui.nodes('select')[1], 'json');
            await ui.change(ui.nodes('textarea')[0], '{"large":90071992547409931234,"text":"Grüße 😀"}');
            await ui.click('Save'); const dialog = () => ui.nodes('dialog')[0]; let inputs = dialog().findAllByType('input');
            await ui.change(inputs[0], 'Saved request'); inputs = dialog().findAllByType('input'); await ui.change(inputs[1], 'My API'); await ui.submit();
            assert(!ui.nodes('dialog').length && text(ui.root).includes('Collections saved.'), 'Confirmed save must close dialog and notify');
            const saved = await repository.load(new AbortController().signal); assert(saved.collections[0].requests[0].draft.body.includes('90071992547409931234') && sent === 0, 'Saving must preserve raw body and never send');
            await ui.click('New request'); assert(ui.nodes('input').find(node => node.props.type === 'url')!.props.value === '', 'New request clears editor');
            await ui.click('POSTSaved request'); assert(ui.nodes('input').find(node => node.props.type === 'url')!.props.value === 'https://example.test/api' && sent === 0, 'Sidebar load must restore without sending');
            await ui.change(ui.nodes('input').find(node => node.props.type === 'url')!, 'https://example.test/changed'); await ui.click('New request');
            assert(text(dialog()).includes('Replace unsaved request?'), 'Unsaved changes need confirmation'); await ui.click('Cancel');
            assert(ui.nodes('input').find(node => node.props.type === 'url')!.props.value.endsWith('/changed'), 'Cancel preserves draft');
            await ui.click('New request'); await ui.click('Discard draft and load'); await ui.click('POSTSaved request');
            await ui.click('Delete request: Saved request'); await ui.click('Cancel'); assert((await repository.load(new AbortController().signal)).collections[0].requests.length === 1, 'Cancel must not delete');
            await ui.click('Delete request: Saved request'); await ui.submit(); assert((await repository.load(new AbortController().signal)).collections[0].requests.length === 0 && sent === 0, 'Confirmed deletion must persist without HTTP execution');
        } finally { await ui.close(); globalThis.fetch = original; }
    } },
    { name: 'Collections load lazily; failed loads can retry and failed saves retain the editor and reason', async run() {
        let loads = 0, writes = 0; const session = createSessionRestCollectionsRepository();
        const repository: RestCollectionsRepository = { persistence: 'account', async load(signal) { if (++loads === 1) throw new Error('Synthetic offline'); return session.load(signal); }, async save() { writes++; throw new Error('Synthetic database failure'); } };
        const ui = await fixture(repository, false); try {
            assert(loads === 0, 'Hidden REST client must not load private data'); await ui.active(true);
            assert(text(ui.root).includes('Synthetic offline'), 'Load reason must be visible'); await ui.click('Reload collections');
            await ui.change(ui.nodes('input').find(node => node.props.type === 'url')!, 'https://example.test/kept'); await ui.click('Save');
            let dialog = ui.nodes('dialog')[0]; await ui.change(dialog.findAllByType('input')[0], 'Draft'); dialog = ui.nodes('dialog')[0]; await ui.change(dialog.findAllByType('input')[1], 'Collection'); await ui.submit();
            assert(ui.nodes('dialog').length === 1 && text(ui.nodes('dialog')[0]).includes('Synthetic database failure') && writes === 1, 'Failed save retains dialog and displays reason without automatic retry');
            assert(ui.nodes('input').find(node => node.props.type === 'url')!.props.value.endsWith('/kept'), 'Failed save preserves draft');
        } finally { await ui.close(); }
    } },
    { name: 'Request tabs support arrow keys and expose only the selected panel', async run() {
        const ui = await fixture(); try {
            const tabs = () => ui.nodes('button').filter(node => node.props.role === 'tab');
            await act(async () => { tabs()[0].props.onKeyDown({ key: 'ArrowRight', preventDefault() {} }); });
            assert(tabs()[1].props['aria-selected'] === true && tabs()[0].props.tabIndex === -1, 'Arrow must select and move tab stop');
            assert(ui.nodes('div').filter(node => node.props.role === 'tabpanel').length === 1, 'Only active panel is exposed');
        } finally { await ui.close(); }
    } }
];

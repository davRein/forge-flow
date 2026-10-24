import { createElement } from 'react';
import type { ElementType, ReactNode } from 'react';
import { act, create } from 'react-test-renderer';
import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { LanguageContext } from '../hooks/languageContext';
import { WorkspaceContext } from '../hooks/workspaceContext';
import { createWorkspaceStore } from '../services/workspace/workspaceStore';
import type { Workspace } from '../services/workspace/workspaceTypes';
import type { AppLanguage } from '../types/settings.types';
import { darkTheme } from '../styles/theme';
import { modules } from '../config/moduleConfig';
import Topbar from '../components/layout/Topbar';
import WikiPage from './wiki/WikiPage';
import CategoryForm from './wiki/components/CategoryForm';
import DevToolsPage from './devTools/DevToolsPage';
import Converter from './devTools/components/Converter';
import RestClient from './devTools/components/RestClient';
import CopyButton from './devTools/components/CopyButton';

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function text(node: ReactTestInstance): string { return node.children.map((child) => typeof child === 'string' ? child : text(child)).join(''); }
function visible(node: ReactTestInstance): boolean { return !node.props.hidden && (!node.parent || visible(node.parent)); }
const timestamp = '2026-10-22T10:15:00Z';

async function fixture(initial: ReactNode, route = '/wiki/articles', language: AppLanguage = 'en') {
    const initialData: Workspace = { projects: [], customers: [], tasks: [], activities: [], epics: [], sprints: [], files: [], wiki: {
        articles: [{ id: 1, title: 'Artikel', content: '# Beschreibung\n\nEigener Inhalt mit {count}.', categoryId: 1, createdAt: timestamp, updatedAt: timestamp }],
        categories: [{ id: 1, name: 'Kategorien', description: 'Darstellung', createdAt: timestamp, updatedAt: timestamp }]
    } };
    const store = createWorkspaceStore({ persistence: 'account', async load() { return { data: initialData, revision: '1' }; }, async save() { return '2'; } });
    await store.load();
    let element = initial;
    let currentLanguage = language;
    function Host({ language: selected }: { language: AppLanguage }) {
        return createElement(ThemeProvider, { theme: darkTheme }, createElement(LanguageContext.Provider, { value: selected },
            createElement(WorkspaceContext.Provider, { value: store }, createElement(MemoryRouter, { initialEntries: [route] }, element))));
    }
    let renderer!: ReactTestRenderer;
    await act(async () => {
        renderer = create(createElement(Host, { language: currentLanguage }), { createNodeMock() { return { showModal() {}, close() {} }; } });
    });
    const controls = (type: ElementType) => renderer.root.findAllByType(type).filter(visible);
    return { get root() { return renderer.root; }, store, controls,
        async language(next: AppLanguage) { currentLanguage = next; await act(async () => renderer.update(createElement(Host, { language: currentLanguage }))); },
        async page(next: ReactNode) { element = next; await act(async () => renderer.update(createElement(Host, { language: currentLanguage }))); },
        async change(node: ReactTestInstance, value: string) { await act(async () => node.props.onChange({ target: { value } })); },
        async click(label: string) {
            const button = controls('button').find((node) => text(node) === label);
            assert(button, `Schaltfläche ${label} fehlt`);
            await act(async () => { await button.props.onClick(); });
        },
        async submit() { await act(async () => controls('form')[0].props.onSubmit({ preventDefault() {} })); },
        async close() { await act(async () => renderer.unmount()); store.dispose(); }
    };
}

export const localizationTests = [
    { name: 'Wiki übersetzt Listen und Datumsanzeigen, nicht eigene Titel oder Kategorien', async run() {
        const ui = await fixture(createElement(WikiPage, { section: 'articles' }));
        try {
            assert(text(ui.controls('h1')[0]) === 'Pages', 'Dokumentationstitel muss Englisch sein');
            assert(ui.controls('h2').some((node) => text(node) === 'Artikel'), 'Eigener Artikeltitel darf nicht übersetzt werden');
            assert(ui.controls('a').some((node) => text(node) === 'Kategorien'), 'Eigener Kategoriename darf nicht übersetzt werden');
            assert(text(ui.controls('time')[0]) === new Date(timestamp).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }), 'Datumsformat muss zur Sprache passen');
            await ui.language('de');
            assert(text(ui.controls('h1')[0]) === 'Seiten', 'Dokumentation muss zurück auf Deutsch wechseln');
            assert(text(ui.controls('time')[0]) === new Date(timestamp).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }), 'Deutsches Datumsformat fehlt');
        } finally { await ui.close(); }
    } },
    { name: 'Wiki-Entwurf und Vorschau bleiben beim Sprachwechsel unverändert', async run() {
        const ui = await fixture(createElement(WikiPage, { section: 'articles' }), '/wiki/articles?edit=new', 'de');
        try {
            await ui.change(ui.controls('input')[0], 'Darstellung');
            await ui.change(ui.controls('textarea')[0], '# Artikel\n\nEigener Inhalt {count}.');
            await ui.language('en');
            assert(ui.controls('input')[0].props.value === 'Darstellung', 'Entwurfstitel muss erhalten bleiben');
            assert(ui.controls('textarea')[0].props.value === '# Artikel\n\nEigener Inhalt {count}.', 'Inhalt muss exakt erhalten bleiben');
            await ui.click('Preview');
            assert(ui.controls('h2').some((node) => text(node) === 'Artikel'), 'Vorschau darf eigene Überschriften nicht übersetzen');
            await ui.language('de');
            assert(ui.controls('section').some((node) => node.props['aria-label'] === 'Artikelvorschau'), 'Vorschauzustand muss beim Sprachwechsel erhalten bleiben');
            await ui.submit();
            assert(ui.store.getSnapshot().data?.wiki.articles.some((article) => article.title === 'Darstellung' && article.content === '# Artikel\n\nEigener Inhalt {count}.'), 'Speichern muss unveränderte Nutzdaten übernehmen');
            await ui.language('en');
            assert(ui.controls('p').some((node) => node.props.role === 'status' && text(node) === 'Page saved.'), 'Bereits vorhandene Rückmeldung muss die neue Sprache verwenden');
        } finally { await ui.close(); }
    } },
    { name: 'Wiki-Kategoriedialog übersetzt Validierungsfehler und behält Formulareingaben', async run() {
        const ui = await fixture(createElement(CategoryForm, { category: null, onClose() {}, onSave: () => 'Eine Kategorie mit diesem Namen ist bereits vorhanden.' }));
        try {
            await ui.change(ui.controls('input')[0], 'Kategorien');
            await ui.submit();
            assert(ui.controls('p').some((node) => node.props.role === 'alert' && text(node) === 'A category with this name already exists.'), 'Kategoriefehler muss Englisch sein');
            await ui.language('de');
            assert(ui.controls('input')[0].props.value === 'Kategorien', 'Eingaben dürfen beim Sprachwechsel nicht verschwinden');
            assert(ui.controls('p').some((node) => node.props.role === 'alert' && text(node).startsWith('Eine Kategorie')), 'Bestehender Fehler muss auf Deutsch wechseln');
        } finally { await ui.close(); }
    } },
    { name: 'JSON und Werkzeugzustände bleiben bei Sprach- und Ansichtswechseln exakt erhalten', async run() {
        const ui = await fixture(createElement(DevToolsPage, { section: 'json' }), '/devTools/json');
        try {
            const source = '{"projekt":"Artikel","n":9007199254740993}';
            await ui.change(ui.controls('textarea')[0], source);
            await ui.click('Format');
            const output = ui.controls('textarea')[1].props.value;
            assert(output.includes('9007199254740993') && output.includes('"Artikel"'), 'Formatieren darf keine Zahlen oder Werte übersetzen');
            await ui.language('de');
            assert(ui.controls('textarea')[0].props.value === source && ui.controls('textarea')[1].props.value === output, 'Sprachwechsel darf JSON nicht ändern');
            await ui.page(createElement(DevToolsPage, { section: 'calculator' }));
            await ui.page(createElement(DevToolsPage, { section: 'json' }));
            assert(ui.controls('textarea')[0].props.value === source, 'Modulzustände müssen weiterhin erhalten bleiben');
            await ui.language('en');
            assert(ui.controls('p').some((node) => node.props.role === 'status' && text(node) === 'JSON formatted.'), 'Statusmeldung muss live übersetzt werden');
        } finally { await ui.close(); }
    } },
    { name: 'Rechnerfehler und Verlauf wechseln die Sprache ohne Neuberechnung', async run() {
        const ui = await fixture(createElement(DevToolsPage, { section: 'calculator' }), '/devTools/calculator', 'de');
        try {
            await ui.change(ui.controls('input')[0], '1 / 0');
            await ui.submit();
            await ui.language('en');
            assert(ui.controls('p').some((node) => node.props.role === 'alert' && text(node) === 'Division by zero is not allowed.'), 'Bestehender Rechenfehler muss Englisch werden');
            await ui.change(ui.controls('input')[0], '2^3');
            await ui.submit();
            await ui.language('de');
            assert(ui.controls('td').some((node) => text(node) === '2^3') && ui.controls('td').some((node) => text(node) === '8'), 'Verlauf und Ergebnisse dürfen nicht verloren gehen');
        } finally { await ui.close(); }
    } },
    { name: 'Konverter übersetzt Einheiten und Fehler, behält aber technische Werte', async run() {
        const ui = await fixture(createElement(Converter));
        try {
            assert(ui.controls('option').some((node) => node.props.value === 'm' && text(node) === 'Metres (m)'), 'Einheitennamen müssen übersetzt werden, IDs nicht');
            await ui.change(ui.controls('select')[0], 'base64Decode');
            await ui.change(ui.controls('textarea')[0], '%%%');
            await ui.click('Convert');
            assert(ui.controls('p').some((node) => node.props.role === 'alert' && text(node).includes('valid Base64')), 'Base64-Fehler muss Englisch sein');
            await ui.change(ui.controls('input').slice(-1)[0], 'FF');
            assert(ui.controls('p').some((node) => node.props.role === 'alert' && text(node) === 'The digit “f” is not valid in base 10.'), 'Dynamischer Basisfehler muss Englisch sein');
            await ui.language('de');
            assert(ui.controls('textarea')[0].props.value === '%%%' && ui.controls('input').slice(-1)[0].props.value === 'FF', 'Konvertereingaben dürfen nicht verändert werden');
        } finally { await ui.close(); }
    } },
    { name: 'REST-Antwort und Anfrage bleiben beim Sprachwechsel unverändert und werden nicht erneut gesendet', async run() {
        const original = globalThis.fetch;
        let calls = 0;
        let body = '';
        globalThis.fetch = async (_url, init) => {
            calls++; body = String(init?.body);
            return new Response('{"Artikel":"Kategorien","n":9007199254740993}', { headers: { 'X-Test': 'Darstellung' } });
        };
        const ui = await fixture(createElement(RestClient));
        try {
            await ui.change(ui.controls('input').find((node) => node.props.type === 'url')!, 'https://test.example/api');
            await ui.change(ui.controls('select')[0], 'POST');
            await ui.click('Request body');
            await ui.change(ui.controls('select')[1], 'json');
            await ui.change(ui.controls('textarea')[0], '{"name":"Darstellung"}');
            await ui.submit();
            const response = ui.controls('textarea').slice(-1)[0].props.value;
            assert(calls === 1 && body === '{"name":"Darstellung"}', 'Anfrageinhalt muss exakt übermittelt werden');
            assert(response.includes('"Artikel"') && response.includes('9007199254740993'), 'Antwortdaten dürfen nicht übersetzt oder gerundet werden');
            await ui.language('de');
            assert(calls === 1 && ui.controls('textarea').slice(-1)[0].props.value === response, 'Sprachwechsel darf keine neue Anfrage auslösen oder die Antwort verändern');
        } finally { await ui.close(); globalThis.fetch = original; }
    } },
    { name: 'REST-Netzwerkfehler und Kopiermeldungen werden in beiden Sprachen dargestellt', async run() {
        const original = globalThis.fetch;
        globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
        const ui = await fixture(createElement(RestClient));
        try {
            await ui.change(ui.controls('input').find((node) => node.props.type === 'url')!, 'https://test.example/api');
            await ui.submit();
            assert(ui.controls('p').some((node) => node.props.role === 'alert' && text(node).includes('CORS permissions')), 'Netzwerkhinweis muss Englisch sein');
            await ui.language('de');
            assert(ui.controls('p').some((node) => node.props.role === 'alert' && text(node).includes('CORS-Freigabe')), 'Netzwerkhinweis muss zurück auf Deutsch wechseln');
            await ui.page(createElement(CopyButton, { text: 'Artikel {count}' }));
            const navigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
            let copied = '';
            try {
                Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { async writeText(value: string) { copied = value; } } } });
                await ui.click('Kopieren');
                await ui.language('en');
                assert(copied === 'Artikel {count}' && ui.controls('span').some((node) => node.props.role === 'status' && text(node) === 'Copied.'), 'Kopierinhalt muss erhalten bleiben, Rückmeldung nicht');
            } finally { if (navigator) Object.defineProperty(globalThis, 'navigator', navigator); else Reflect.deleteProperty(globalThis, 'navigator'); }
        } finally { await ui.close(); globalThis.fetch = original; }
    } },
    { name: 'Wiki- und Dev-Tools-Navigation wird übersetzt und behält ihre Routen', async run() {
        const ui = await fixture(createElement(Topbar, { items: modules[1].topbarItems, moduleKey: 'wiki' }));
        try {
            assert(ui.controls('a').map(text).join(',') === 'Overview,Pages,Spaces,Search', 'Dokumentationsnavigation muss Englisch sein');
            assert(ui.controls('a')[1].props.href === '/wiki/articles', 'Sprachwechsel darf Routen nicht ändern');
            await ui.page(createElement(Topbar, { items: modules[2].topbarItems, moduleKey: 'devTools' }));
            assert(ui.controls('a').map(text).join(',') === 'JSON Formatter,REST client,Calculator,Converters', 'Dev-Tools-Navigation muss Englisch sein');
            await ui.language('de');
            assert(ui.controls('a').map(text).join(',') === 'JSON Formatter,REST-Test,Rechner,Konverter', 'Deutsche Navigation muss weiter verfügbar sein');
        } finally { await ui.close(); }
    } }
];

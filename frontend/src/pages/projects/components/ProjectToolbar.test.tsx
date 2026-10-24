import { act, create } from 'react-test-renderer';
import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter } from 'react-router-dom';
import { LanguageContext } from '../../../hooks/languageContext';
import { WorkspaceContext } from '../../../hooks/workspaceContext';
import { createWorkspaceStore } from '../../../services/workspace/workspaceStore';
import { emptyWorkspace } from '../../../services/workspace/workspaceSchema';
import { defaultSettings } from '../../../config/appSettings';
import { darkTheme } from '../../../styles/theme';
import type { AppLanguage } from '../../../types/settings.types';
import ProjectsPage from '../ProjectsPage';

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const text = (node: ReactTestInstance): string => node.children.map(child => typeof child === 'string' ? child : text(child)).join('');

async function fixture(language: AppLanguage = 'en', section = 'projects') {
    const customer = { id: 1, name: 'Acme', street: '', city: '', country: '', email: '', phone: '', industry: '' };
    const data = { ...emptyWorkspace(), files: [], customers: [customer, { ...customer, id: 2, name: 'Beta company' }],
        projects: [{ id: 1, customerId: 1, name: 'Alpha', planningCompleted: false, deadline: '2026-12-31' }, { id: 2, customerId: 2, name: 'Second project', planningCompleted: false, deadline: '2026-12-31' }] };
    let writes = 0; const focused: string[] = [];
    const store = createWorkspaceStore({ persistence: 'account', async load() { return { data, revision: '1' }; }, async save() { writes++; return '2'; } });
    await store.load(); let renderer!: ReactTestRenderer;
    await act(async () => { renderer = create(<ThemeProvider theme={darkTheme}><LanguageContext.Provider value={language}><MemoryRouter initialEntries={[`/projectManager/${section}`]}><WorkspaceContext.Provider value={store}>
        <ProjectsPage section={section} settings={{ ...defaultSettings, language }} onSettingsChange={() => {}} onSettingsReset={() => {}} settingsStatus="ready" settingsError={null} settingsPersistence="account" onSettingsRetry={() => {}} />
    </WorkspaceContext.Provider></MemoryRouter></LanguageContext.Provider></ThemeProvider>, { createNodeMock(element) { return { focus() { focused.push(element.props.type === 'search' ? 'search-input' : element.props['aria-controls'] ? 'search-toggle' : String(element.type)); } }; } }); });
    return { get root() { return renderer.root; }, store, focused, get writes() { return writes; },
        async click(label: string) { const button = renderer.root.findAllByType('button').find(node => node.props['aria-label'] === label); assert(button, `Missing ${label}`); await act(async () => button.props.onClick()); },
        async close() { await act(async () => renderer.unmount()); store.dispose(); } };
}

export const projectToolbarTests = [
    { name: 'Projektleiste öffnet die Suche mit Fokus, filtert nach Kunde und setzt mit Escape Ansicht und Fokus zurück', async run() {
        const ui = await fixture(); try {
            const input = () => ui.root.findAllByType('input').find(node => node.props.type === 'search')!;
            const projectFrame = () => ui.root.findAllByType('section').find(node => node.props['aria-label'] === 'Project overview')!;
            assert(input().props.disabled && input().props.tabIndex === -1, 'Closed search must not be tabbable');
            assert(text(projectFrame()).includes('New') && !text(ui.root).includes('+ Projekt anlegen'), 'New must be inside the project frame');
            await ui.click('Open project search');
            assert(!input().props.disabled && ui.focused[ui.focused.length - 1] === 'search-input', 'Opening must focus the search input');
            await act(async () => input().props.onChange({ target: { value: 'beta company' } }));
            assert(text(projectFrame()).includes('Second project') && !text(projectFrame()).includes('Alpha') && text(projectFrame()).includes('1 / 2'), 'Customer search must filter projects and update count');
            await act(async () => input().props.onChange({ target: { value: 'missing' } }));
            assert(text(projectFrame()).includes('No projects match this search.'), 'Empty search result must retain the toolbar');
            let prevented = false; await act(async () => input().props.onKeyDown({ key: 'Escape', preventDefault() { prevented = true; } }));
            assert(prevented && input().props.disabled && input().props.value === '' && text(projectFrame()).includes('Alpha') && text(projectFrame()).includes('Second project'), 'Escape must close and reset the filter');
            assert(ui.focused[ui.focused.length - 1] === 'search-toggle' && ui.writes === 0 && ui.store.getSnapshot().data!.projects.length === 2, 'Search must restore focus without modifying data');
        } finally { await ui.close(); }
    } },
    { name: 'Neu öffnet das bestehende Projektformular aus kompakter Liste und Dashboard; deutsche Lupe kann die Suche schließen', async run() {
        for (const section of ['projects', 'dashboard']) {
            const ui = await fixture('de', section); try {
                const action = ui.root.findAllByType('button').find(node => node.props['aria-label'] === 'Neues Projekt');
                assert(action && text(action) === 'Neu' && action.findAllByType('svg').length === 1, 'New must have a folder icon and localized label');
                await ui.click('Projektsuche öffnen');
                const input = ui.root.findAllByType('input').find(node => node.props.type === 'search')!;
                await act(async () => input.props.onChange({ target: { value: 'Alpha' } }));
                await ui.click('Projektsuche schließen');
                assert(ui.root.findAllByType('input').find(node => node.props.type === 'search')?.props.value === '', 'Toggle must clear the hidden filter');
                await ui.click('Neues Projekt'); assert(ui.root.findAllByType('form').some(node => text(node).includes('Neues Projekt')), 'New must open the existing creation form');
                assert(ui.writes === 0, 'Opening a form must not create a project');
            } finally { await ui.close(); }
        }
    } }
];

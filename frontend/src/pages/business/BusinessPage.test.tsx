import { useState } from 'react';
import { act, create } from 'react-test-renderer';
import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { darkTheme } from '../../styles/theme';
import { LanguageContext } from '../../hooks/languageContext';
import { BusinessContext } from '../../hooks/businessContext';
import { TimeTrackingContext } from '../../hooks/timeTrackingContext';
import { WorkspaceContext } from '../../hooks/workspaceContext';
import { useNavigationGuard } from '../../hooks/navigationGuard';
import NavigationGuardProvider from '../../components/navigation/NavigationGuardProvider';
import { createBusinessStore, createSessionBusinessRepository, emptyBusiness } from '../../services/business/business';
import { createSessionTimeTrackingRepository, createTimeTrackingStore } from '../../services/time/timeTracking';
import { createWorkspaceStore } from '../../services/workspace/workspaceStore';
import type { Workspace } from '../../services/workspace/workspaceTypes';
import BusinessPage from './BusinessPage';

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const text = (node: ReactTestInstance): string => node.children.map(child => typeof child === 'string' ? child : text(child)).join('');
async function fixture(section: string) {
    const repository = createSessionBusinessRepository(), signal = new AbortController().signal, initial = emptyBusiness();
    await repository.save({ ...initial, profile: { ...initial.profile, company: 'Test Company', address: 'Test street', hourlyRateCents: 10000, taxBasisPoints: 1900 } }, signal);
    const store = createBusinessStore(repository); await store.load(); const times = createTimeTrackingStore(createSessionTimeTrackingRepository()); await times.load();
    const data: Workspace = { customers: [{ id: 1, name: 'Acme', street: '', city: '', country: '', industry: '', email: '', phone: '' }], projects: [{ id: 1, customerId: 1, name: 'Existing project', deadline: '2026-12-31', planningCompleted: false }], tasks: [], activities: [], epics: [], sprints: [], files: [], wiki: { articles: [], categories: [] } };
    const workspace = createWorkspaceStore({ persistence: 'session', async load() { return { revision: '1', data }; }, async save() { return '2'; } }); await workspace.load();
    let url = '', left = false; let renderer!: ReactTestRenderer;
    function Host() { const location = useLocation(), guard = useNavigationGuard(); const [, setLeft] = useState(false); url = location.pathname;
        return <><button onClick={() => guard.request(() => { left = true; setLeft(true); })}>Leave test</button><BusinessPage section={url.split('/')[2]} /></>;
    }
    await act(async () => { renderer = create(<ThemeProvider theme={darkTheme}><LanguageContext.Provider value="en"><MemoryRouter initialEntries={[`/business/${section}`]}><NavigationGuardProvider><WorkspaceContext.Provider value={workspace}><BusinessContext.Provider value={store}><TimeTrackingContext.Provider value={times}><Host /></TimeTrackingContext.Provider></BusinessContext.Provider></WorkspaceContext.Provider></NavigationGuardProvider></MemoryRouter></LanguageContext.Provider></ThemeProvider>, { createNodeMock() { return { showModal() {}, close() {}, focus() {} }; } }); });
    return { get root() { return renderer.root; }, store, workspace, get left() { return left; }, get url() { return url; },
        async click(label: string) { const node = renderer.root.findAllByType('button').find(value => text(value) === label); assert(node && !node.props.disabled, `Missing action ${label}`); await act(async () => node.props.onClick()); },
        async change(label: string, value: string) { const form = renderer.root.findAllByType('form')[0] ?? renderer.root; const field = form.findAllByType('label').find(node => node.children.some(child => child === label)); assert(field, `Missing field ${label}`); const control = field.find(node => ['input', 'select', 'textarea'].includes(String(node.type))); await act(async () => control.props.onChange({ target: { value, valueAsNumber: Number(value) } })); },
        async submit() { await act(async () => renderer.root.findAllByType('form')[0].props.onSubmit({ preventDefault() {} })); },
        async close() { await act(async () => renderer.unmount()); store.dispose(); times.dispose(); workspace.dispose(); }
    };
}
export const businessPageTests = [
    { name: 'Invoice editor saves explicit drafts with exact line totals and preserves company settings', async run() {
        const ui = await fixture('documents'); try {
            await ui.click('+ Invoice'); await ui.click('+ Line item'); await ui.change('Service', 'Implementation'); await ui.change('Quantity', '1.5');
            assert(text(ui.root).includes('178.50'), 'Preview must include net and configured tax'); await ui.submit();
            assert(ui.store.getSnapshot().data!.documents.length === 1 && ui.store.getSnapshot().data!.documents[0].status === 'draft' && ui.root.findAllByType('dialog').length === 0, 'Saving a draft must not issue it');
            assert(ui.store.getSnapshot().data!.profile.company === 'Test Company', 'Document saves must preserve settings');
        } finally { await ui.close(); }
    } },
    { name: 'Business profile drafts prompt before leaving and stay preserves inputs', async run() {
        const ui = await fixture('profile'); try { await ui.change('Company / name', 'Unsaved company'); await ui.click('Leave test');
            assert(!ui.left && ui.root.findAllByType('dialog').length === 1, 'Dirty billing profile must block navigation'); await ui.click('Stay on this page'); assert(text(ui.root).includes('Sender & billing') && !ui.left, 'Stay must retain the form');
            await ui.submit(); assert(ui.store.getSnapshot().data!.profile.company === 'Unsaved company', 'Explicit save must commit profile changes');
        } finally { await ui.close(); }
    } },
    { name: 'Project templates retain multiline input and create connected project tasks and milestones', async run() {
        const ui = await fixture('templates'); try {
            await ui.click('+ Template'); await ui.change('Name', 'Website template'); await ui.change('Tasks (one per line)', 'Plan\nBuild\n'); await ui.change('Milestones (one per line)', 'Launch\n'); await ui.submit();
            assert(ui.store.getSnapshot().data!.templates[0].tasks.length === 2, 'Trailing newlines must remain typeable and be removed only when saving');
            await ui.click('Create project from template'); await ui.change('Project name', 'New website'); await ui.submit();
            assert(ui.workspace.getSnapshot().data!.projects.length === 2 && ui.workspace.getSnapshot().data!.tasks.length === 2 && ui.workspace.getSnapshot().data!.epics.length === 1 && ui.url.includes('/projectManager/projects'), 'Using a template must create related data and navigate to the new project');
        } finally { await ui.close(); }
    } }
];

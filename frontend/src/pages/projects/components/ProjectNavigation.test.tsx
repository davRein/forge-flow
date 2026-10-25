import { useState } from 'react';
import type { ElementType } from 'react';
import { act, create } from 'react-test-renderer';
import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import NavigationGuardProvider from '../../../components/navigation/NavigationGuardProvider';
import Topbar from '../../../components/layout/Topbar';
import { AuthContext } from '../../../hooks/authContext';
import { LanguageContext } from '../../../hooks/languageContext';
import { WorkspaceContext } from '../../../hooks/workspaceContext';
import { defaultSettings } from '../../../config/appSettings';
import { modules } from '../../../config/moduleConfig';
import { darkTheme } from '../../../styles/theme';
import { createApiClient } from '../../../services/api/apiClient';
import { createAuthStore } from '../../../services/auth/authStore';
import { createWorkspaceStore } from '../../../services/workspace/workspaceStore';
import { emptyWorkspace } from '../../../services/workspace/workspaceSchema';
import ProjectsPage from '../ProjectsPage';

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const text = (node: ReactTestInstance): string => node.children.map(child => typeof child === 'string' ? child : text(child)).join('');
const visible = (node: ReactTestInstance): boolean => !node.props.hidden && (!node.parent || visible(node.parent));
async function fixture(route = '/projectManager/dashboard') {
    const customer = { id: 1, name: 'Acme', street: 'Street 1', postalCode: '01234', city: 'Town', country: 'DE', email: 'test@example.test', phone: '123', industry: 'IT' };
    const data = { ...emptyWorkspace(), files: [], customers: [customer], projects: [{ id: 1, customerId: 1, name: 'Alpha', planningCompleted: false, deadline: '2026-12-31' }] };
    let revision = 0;
    const workspace = createWorkspaceStore({ persistence: 'session', async load() { return { data, revision: 'initial' }; }, async save() { return String(++revision); } }); await workspace.load();
    const auth = createAuthStore(createApiClient('/api/v1', async () => new Response(JSON.stringify({ user: { id: 'test-user', name: 'Test User', email: 'user@example.test', administrator: false }, csrfToken: 'test' }))), true); await auth.refresh();
    let url = '';
    function Host() {
        const location = useLocation(); url = location.pathname + location.search;
        const [settings, setSettings] = useState({ ...defaultSettings, language: 'en' as const });
        return <><Topbar moduleKey="projectManager" items={modules[0].topbarItems} /><ProjectsPage section={location.pathname.split('/')[2]} settings={settings} onSettingsChange={next => setSettings({ ...next, language: 'en' })} onSettingsReset={() => {}} settingsStatus="ready" settingsError={null} settingsPersistence="session" onSettingsRetry={() => {}} /></>;
    }
    let renderer!: ReactTestRenderer;
    await act(async () => { renderer = create(<ThemeProvider theme={darkTheme}><LanguageContext.Provider value="en"><AuthContext.Provider value={auth}><MemoryRouter initialEntries={[route]}><NavigationGuardProvider><WorkspaceContext.Provider value={workspace}><Host /></WorkspaceContext.Provider></NavigationGuardProvider></MemoryRouter></AuthContext.Provider></LanguageContext.Provider></ThemeProvider>, { createNodeMock() { return { showModal() {}, close() {}, focus() {} }; } }); });
    const nodes = (type: ElementType) => renderer.root.findAllByType(type).filter(visible);
    return { get root() { return renderer.root; }, get url() { return url; }, nodes, workspace,
        async tab(label: string) {
            const link = nodes('a').find(node => text(node) === label); assert(link, `Missing navigation ${label}`);
            const event = { button: 0, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, metaKey: false, altKey: false, ctrlKey: false, shiftKey: false };
            await act(async () => { link.props.onClick(event); });
        },
        async click(label: string) { const button = nodes('button').find(node => node.props['aria-label'] === label || text(node).startsWith(label)); assert(button && !button.props.disabled, `Missing button ${label}`); await act(async () => { button.props.onClick({ stopPropagation() {} }); }); },
        async change(node: ReactTestInstance, value: string) { await act(async () => { node.props.onChange({ target: { value } }); }); },
        async close() { await act(async () => { renderer.unmount(); }); workspace.dispose(); auth.dispose(); }
    };
}
export const projectNavigationTests = [
    { name: 'Unsaved task completion asks before main and project tab changes, preserves edits on stay and discards without saving', async run() {
        const ui = await fixture('/projectManager/projects?project=1'); try {
            await act(async () => { ui.workspace.update('tasks', [{ id: 1, projectId: 1, code: 'FF-1', title: 'Existing task', description: '', status: 'todo', priority: 'medium', createdAt: '2026-10-25', updatedAt: '2026-10-25' }]); });
            await ui.click('Tasks');
            const edit = ui.nodes('button').find(node => text(node).trim() === '✎'); assert(edit, 'Task edit action missing'); await act(async () => { edit.props.onClick(); });
            const status = () => ui.nodes('select').find(node => node.props['aria-label'] === 'Status')!;
            await ui.change(status(), 'done'); await ui.tab('Dashboard');
            assert(ui.nodes('dialog').length === 1 && String(ui.url).includes('project=1'), 'Unsaved status must pause the main-tab change');
            await ui.click('Stay on this page'); assert(status().props.value === 'done' && ui.workspace.getSnapshot().data!.tasks[0].status === 'todo', 'Stay retains the draft without committing completion');
            await ui.click('Board'); assert(ui.nodes('dialog').length === 1, 'Project subtab must also ask');
            await ui.click('Discard changes and continue'); assert(ui.nodes('form').length === 0 && ui.workspace.getSnapshot().data!.tasks[0].status === 'todo', 'Discard closes task editor and preserves saved status');
            await ui.tab('Dashboard'); assert(String(ui.url) === '/projectManager/dashboard' && ui.nodes('dialog').length === 0, 'No draft should remain after discard');
        } finally { await ui.close(); }
    } },
    { name: 'Main tabs always open their roots and dashboard project links activate Projects', async run() {
        const ui = await fixture(); try {
            await ui.click('Open project'); assert(String(ui.url) === '/projectManager/projects?project=1', 'Dashboard must navigate to the project route');
            assert(ui.nodes('a').find(node => text(node) === 'Projects')?.props['aria-current'] === 'page', 'Projects must become active');
            await ui.tab('Projects'); assert(String(ui.url) === '/projectManager/projects' && !ui.nodes('h2').some(node => text(node) === 'Alpha'), 'Active Projects click must reset to list');
            await ui.click('Alpha'); await ui.tab('Dashboard'); await ui.tab('Projects'); assert(String(ui.url) === '/projectManager/projects', 'Returning must not restore old details');
            await ui.tab('Customers'); await ui.click('Acme'); assert(String(ui.url).includes('customer=1'), 'Customer detail route missing'); await ui.tab('Customers'); assert(String(ui.url) === '/projectManager/customers', 'Customers must reset detail selection');
            await ui.tab('Settings'); await ui.tab('Language'); assert(String(ui.url).includes('category=language'), 'Settings category missing'); await ui.tab('Settings'); assert(String(ui.url) === '/projectManager/settings', 'Settings main tab must reset category');
        } finally { await ui.close(); }
    } },
    { name: 'Changed project forms prompt before tab navigation; stay preserves inputs and discard removes the draft', async run() {
        const ui = await fixture('/projectManager/projects'); try {
            await ui.click('New project'); await ui.change(ui.nodes('input').find(node => !node.props.type)!, 'Unsaved project');
            await ui.tab('Customers'); assert(String(ui.url) === '/projectManager/projects' && ui.nodes('dialog').some(node => text(node).includes('Unsaved changes')), 'Navigation must pause for confirmation');
            await ui.click('Stay on this page'); assert(ui.nodes('input').some(node => node.props.value === 'Unsaved project'), 'Stay must preserve draft');
            await ui.tab('Customers'); await ui.click('Discard changes and continue'); assert(String(ui.url) === '/projectManager/customers', 'Confirmed navigation missing');
            await ui.tab('Projects'); assert(ui.nodes('form').length === 0 && ui.workspace.getSnapshot().data!.projects.length === 1, 'Discard must not persist or reopen the form');
            await ui.click('New project'); await ui.tab('Dashboard'); assert(ui.nodes('dialog').length === 0, 'An untouched form must not warn');
        } finally { await ui.close(); }
    } },
    { name: 'Customer and account drafts prompt before leaving and discard resets profile inputs', async run() {
        const ui = await fixture('/projectManager/customers?customer=1'); try {
            await ui.click('Edit company details'); await ui.change(ui.nodes('dialog')[0].findAllByType('input')[0], 'Unsaved customer');
            await ui.tab('Projects'); await ui.click('Stay on this page'); assert(String(ui.url).includes('customer=1'), 'Stay must retain customer route');
            await ui.tab('Projects'); await ui.click('Discard changes and continue'); assert(ui.workspace.getSnapshot().data!.customers[0].name === 'Acme', 'Discard must not save the customer');
            await ui.tab('Settings'); await ui.tab('User management');
            const profile = ui.nodes('form').find(node => node.props['aria-label'] === 'My profile')!; assert(profile, 'Profile missing'); await ui.change(profile.findAllByType('input')[0], 'Unsaved profile');
            await ui.tab('Appearance'); await ui.click('Stay on this page'); assert(String(ui.url).includes('category=users'), 'Settings category change must be guarded');
            await ui.tab('Appearance'); await ui.click('Discard changes and continue'); await ui.tab('User management');
            assert(ui.nodes('form').find(node => node.props['aria-label'] === 'My profile')!.findAllByType('input')[0].props.value === 'Test User', 'Discarded profile draft must reset');
        } finally { await ui.close(); }
    } },
    { name: 'Dashboard shows the last five confirmed actions and opens the current object from an older event', async run() {
        const ui = await fixture(); try {
            for (let index = 1; index <= 6; index++) await act(async () => { ui.workspace.update('projects', values => values.map(value => ({ ...value, name: `Alpha ${index}` }))); });
            const history = ui.nodes('section').find(node => node.props['aria-label'] === 'Recent activity')!;
            assert(history.findAllByType('li').length === 5 && !text(history).includes('Alpha 1'), 'History must keep five newest actions');
            await ui.click('Updated project “Alpha 2”'); assert(String(ui.url) === '/projectManager/projects?project=1' && ui.nodes('h2').some(node => text(node) === 'Alpha 6'), 'History must open the current project and activate Projects');
            await ui.tab('Dashboard'); await act(async () => { ui.workspace.update('customers', values => values.map(value => ({ ...value, name: 'Acme updated' }))); });
            await ui.click('Updated customer “Acme updated”'); assert(String(ui.url) === '/projectManager/customers?customer=1', 'Customer history must open details in Customers');
        } finally { await ui.close(); }
    } }
];

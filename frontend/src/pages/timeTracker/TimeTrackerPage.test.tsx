import { act, create } from 'react-test-renderer';
import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { darkTheme } from '../../styles/theme';
import { LanguageContext } from '../../hooks/languageContext';
import { WorkspaceContext } from '../../hooks/workspaceContext';
import { TimeTrackingContext } from '../../hooks/timeTrackingContext';
import { BusinessContext } from '../../hooks/businessContext';
import { createBusinessStore, createSessionBusinessRepository } from '../../services/business/business';
import { useNavigationGuard } from '../../hooks/navigationGuard';
import NavigationGuardProvider from '../../components/navigation/NavigationGuardProvider';
import Sidebar from '../../components/layout/Sidenav';
import Topbar from '../../components/layout/Topbar';
import { modules } from '../../config/moduleConfig';
import { createWorkspaceStore } from '../../services/workspace/workspaceStore';
import { emptyWorkspace } from '../../services/workspace/workspaceSchema';
import { createSessionTimeTrackingRepository, createTimeTrackingStore } from '../../services/time/timeTracking';
import type { TimeEntry } from '../../services/time/timeTracking';
import type { AppLanguage } from '../../types/settings.types';
import TimeTrackerPage from './TimeTrackerPage';
import { todayDate, weekStart } from './timeLogic';

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const text = (node: ReactTestInstance): string => node.children.map(child => typeof child === 'string' ? child : text(child)).join('');
async function fixture(language: AppLanguage = 'en', initial = '/timeTracker/calendar') {
    const date = weekStart(todayDate());
    const existing: TimeEntry = { id: '00000000-0000-0000-0000-000000000001', date, startMinute: 540, minutes: 60, breakMinutes: 0, customerId: 1, projectId: 1, customerName: 'Acme', projectName: 'Website', comment: 'Existing booking', billable: true };
    const repository = createSessionTimeTrackingRepository(); await repository.save({ version: 1, revision: 'time-initial', entries: [existing] }, new AbortController().signal);
    let fail = false, loads = 0, writes = 0, url = '';
    const store = createTimeTrackingStore({ persistence: 'account', async load(signal) { loads++; return repository.load(signal); }, async save(value, signal) { writes++; if (fail) throw new Error('Offline test'); return repository.save(value, signal); } });
    const business = createBusinessStore(createSessionBusinessRepository());
    const workspace = createWorkspaceStore({ persistence: 'session', async load() { return { revision: '1', data: { ...emptyWorkspace(), files: [],
        customers: [{ id: 1, name: 'Acme', street: '', city: '', country: '', email: '', phone: '', industry: '' }, { id: 2, name: 'Other company', street: '', city: '', country: '', email: '', phone: '', industry: '' }],
        projects: [{ id: 1, customerId: 1, name: 'Website', planningCompleted: false, deadline: '2026-12-31' }, { id: 2, customerId: 2, name: 'Other project', planningCompleted: false, deadline: '2026-12-31' }] } }; }, async save() { return '2'; } }); await workspace.load();
    function Host() {
        const location = useLocation(), navigate = useNavigate(), guard = useNavigationGuard(); url = location.pathname;
        const active = url.startsWith('/timeTracker/');
        return <><Sidebar modules={modules} activeModule={active ? 'timeTracker' : 'devTools'} onModuleChange={key => guard.request(() => navigate(`/${key}/${modules.find(module => module.key === key)!.topbarItems[0].key}`))} />
            <Topbar moduleKey="timeTracker" items={modules.find(module => module.key === 'timeTracker')!.topbarItems} />
            <TimeTrackerPage active={active} section={url.split('/')[2]} /></>;
    }
    let renderer!: ReactTestRenderer;
    await act(async () => { renderer = create(<ThemeProvider theme={darkTheme}><LanguageContext.Provider value={language}><MemoryRouter initialEntries={[initial]}><NavigationGuardProvider><WorkspaceContext.Provider value={workspace}><BusinessContext.Provider value={business}><TimeTrackingContext.Provider value={store}><Host /></TimeTrackingContext.Provider></BusinessContext.Provider></WorkspaceContext.Provider></NavigationGuardProvider></MemoryRouter></LanguageContext.Provider></ThemeProvider>, { createNodeMock() { return { showModal() {}, close() {}, focus() {} }; } }); });
    return { date, store, business, get root() { return renderer.root; }, get loads() { return loads; }, get writes() { return writes; }, get url() { return url; }, fail() { fail = true; },
        control(label: string) { const scope = renderer.root.findAllByType('form').find(node => ['Time entry', 'Zeiteintrag'].includes(node.props['aria-label'])) ?? renderer.root; const field = scope.findAllByType('label').find(node => node.children.some(child => child === label)); assert(field, `Missing field ${label}`); return field.find(node => ['input', 'select', 'textarea'].includes(String(node.type))); },
        async change(label: string, value: string | number | boolean) { const field = this.control(label); await act(async () => field.props.onChange({ target: { value: String(value), valueAsNumber: Number(value), checked: value } })); },
        async click(label: string) { const node = renderer.root.findAllByType('button').find(node => node.props['aria-label'] === label || text(node) === label); assert(node && !node.props.disabled, `Missing action ${label}`); await act(async () => node.props.onClick()); },
        async tab(label: string) { const node = renderer.root.findAllByType('a').find(node => text(node) === label); assert(node, `Missing tab ${label}`); await act(async () => node.props.onClick({ button: 0, defaultPrevented: false, preventDefault() {}, metaKey: false, altKey: false, ctrlKey: false, shiftKey: false })); },
        async submit() { await act(async () => renderer.root.findAllByType('form').find(node => ['Time entry', 'Zeiteintrag'].includes(node.props['aria-label']))!.props.onSubmit({ preventDefault() {} })); },
        async close() { await act(async () => renderer.unmount()); store.dispose(); business.dispose(); workspace.dispose(); }
    };
}
export const timeTrackerPageTests = [
    { name: 'Stopwatch stops into a reviewable stable-ID entry and completes only after explicit save', async run() {
        const ui = await fixture(); try {
            const timer = ui.root.findAllByType('section').find(node => node.props['aria-label'] === 'Timer')!;
            await act(async () => timer.findByType('form').props.onSubmit({ preventDefault() {} }));
            const id = ui.business.getSnapshot().data!.timer!.id; await ui.click('Stop and review');
            assert(ui.business.getSnapshot().data!.timer?.startedAt === null && ui.store.getSnapshot().data!.entries.length === 1, 'Stopping must pause without committing');
            await ui.submit(); assert(ui.store.getSnapshot().data!.entries.some(value => value.id === id) && ui.business.getSnapshot().data!.timer === null, 'Explicit save must retain stable identity and complete the timer');
        } finally { await ui.close(); }
    } },
    { name: 'TimeTracker follows Dev Tools in the sidebar and loads private entries only when activated', async run() {
        const ui = await fixture('en', '/devTools/json'); try {
            const sidebar = ui.root.findByType('aside'); const buttons = sidebar.findAllByType('button');
            assert(buttons.map(node => node.props['aria-label']).join(',') === 'Project Manager,Documentation,Dev Tools,TimeTracker,Business,Cloud', 'TimeTracker must follow existing apps');
            assert(ui.loads === 0, 'A hidden tracker must not request private time data');
            await ui.click('TimeTracker');
            assert(Number(ui.loads) === 1 && ui.url === '/timeTracker/calendar' && ui.root.findAllByType('time').length === 7, 'Activation must open and load a complete calendar week');
        } finally { await ui.close(); }
    } },
    { name: 'Calendar bookings filter projects by customer, save comments and breaks, and feed the weekly report', async run() {
        const ui = await fixture(); try {
            await ui.click(`Log time: ${ui.date}`);
            await ui.change('Customer', 1);
            assert(ui.control('Project').findAllByType('option').map(text).join(',') === 'No project,Website', 'Only this customer’s projects may be offered');
            await ui.change('Project', 1); await ui.change('Work time (minutes)', 90); await ui.change('Break (minutes)', 15); await ui.change('Comment', 'New work 😀'); await ui.change('Billable', true);
            await ui.submit();
            const saved = ui.store.getSnapshot().data!.entries;
            assert(saved.length === 2 && saved[1].minutes === 90 && saved[1].breakMinutes === 15 && saved[1].customerId === 1 && saved[1].projectId === 1 && !ui.root.findAllByType('form').some(node => node.props['aria-label'] === 'Time entry'), 'Successful save must preserve associations and close the editor');
            assert(text(ui.root).includes('2h 30m') && text(ui.root).includes('New work 😀'), 'Net work totals and comments must be shown');
            await ui.tab('Reports');
            const table = ui.root.findByType('table'); assert(text(table).includes('AcmeWebsite2h 30m2h 30m'), 'Report must group net and billable time by customer/project');
            await act(async () => ui.store.load()); assert(ui.store.getSnapshot().data!.entries[1].comment === 'New work 😀', 'Explicit reload must retain saved bookings');
        } finally { await ui.close(); }
    } },
    { name: 'Failed time saves retain drafts and switching apps prompts before discarding them', async run() {
        const ui = await fixture(); try {
            ui.fail(); await ui.click(`Log time: ${ui.date}`); await ui.change('Comment', 'Unsaved draft'); await ui.submit();
            assert(ui.root.findAllByType('form').some(node => node.props['aria-label'] === 'Time entry') && ui.control('Comment').props.value === 'Unsaved draft' && text(ui.root).includes('Offline test') && ui.store.getSnapshot().data!.entries.length === 1, 'Failed writes must preserve draft, reason and confirmed entries');
            await ui.click('Dev Tools'); assert(ui.root.findAllByType('dialog').length === 2, 'Leaving must prompt while the editor is dirty');
            await ui.click('Stay on this page'); assert(String(ui.url) === '/timeTracker/calendar' && ui.control('Comment').props.value === 'Unsaved draft', 'Stay must preserve the draft');
            await ui.click('Dev Tools'); await ui.click('Discard changes and continue');
            assert(String(ui.url) === '/devTools/json' && !ui.root.findAllByType('form').some(node => node.props['aria-label'] === 'Time entry') && ui.writes === 1, 'Discard must leave without resubmitting');
        } finally { await ui.close(); }
    } },
    { name: 'German calendar opens an existing entry and only deletes after explicit confirmation', async run() {
        const ui = await fixture('de'); try {
            const booking = ui.root.findAllByType('button').find(node => text(node).includes('Existing booking'))!;
            await act(async () => booking.props.onClick());
            assert(ui.control('Arbeitszeit (Minuten)').props.value === 60, 'Existing booking must open with original duration');
            await ui.click('Löschen'); assert(ui.store.getSnapshot().data!.entries.length === 1 && ui.root.findAllByType('dialog').length === 2, 'Delete must require a confirmation');
            await ui.click('Endgültig löschen'); assert(ui.store.getSnapshot().data!.entries.length === 0 && ui.root.findAllByType('dialog').length === 0 && text(ui.root).includes('Keine Einträge'), 'Confirmed deletion must refresh the calendar');
        } finally { await ui.close(); }
    } }
];

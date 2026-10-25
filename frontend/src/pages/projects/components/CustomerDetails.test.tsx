import { act, create } from 'react-test-renderer';
import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { darkTheme } from '../../../styles/theme';
import { LanguageContext } from '../../../hooks/languageContext';
import { WorkspaceContext } from '../../../hooks/workspaceContext';
import { createWorkspaceStore } from '../../../services/workspace/workspaceStore';
import type { Workspace } from '../../../services/workspace/workspaceTypes';
import type { AppLanguage } from '../../../types/settings.types';
import { defaultSettings } from '../../../config/appSettings';
import ProjectsPage from '../ProjectsPage';
import { useCustomerDetails } from '../hooks/useCustomerDetails';
import { useProjects } from '../hooks/useProjects';
import { isWorkspaceMutation } from '../../../services/ai/workspaceActions';

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const text = (node: ReactTestInstance): string => node.children.map(child => typeof child === 'string' ? child : text(child)).join('');
async function fixture(route = '/projectManager/customers', hookOnly = false, language: AppLanguage = 'en') {
    const data: Workspace = { projects: [{ id: 1, customerId: 1, name: 'Customer one project', planningCompleted: false, deadline: '2026-12-31' }, { id: 2, customerId: 2, name: 'Other project', planningCompleted: false, deadline: '2026-12-31' }],
        customers: [{ id: 1, name: 'Customer one', street: 'Street 1', postalCode: '01234', city: 'Town', country: 'DE', email: 'one@example.test', phone: '', industry: 'IT', notes: '<script>Existing note</script>',
            contacts: [{ id: 1, customerId: 1, name: 'First contact', role: 'Manager', email: 'contact@example.test', phone: '123' }] },
            { id: 2, name: 'Customer two', street: '', city: '', country: '', email: '', phone: '', industry: '', contacts: [{ id: 8, customerId: 2, name: 'Other contact', role: '', email: '', phone: '' }] }],
        tasks: [], activities: [], epics: [], sprints: [], files: [], wiki: { articles: [], categories: [] } };
    const workspace = createWorkspaceStore({ persistence: 'session', async load() { return { data, revision: '1' }; }, async save() { return '2'; } }); await workspace.load();
    let details!: ReturnType<typeof useCustomerDetails>, projects!: ReturnType<typeof useProjects>; let url = '';
    function Host() {
        const location = useLocation(); url = location.pathname + location.search; details = useCustomerDetails(); projects = useProjects();
        return hookOnly ? null : <ProjectsPage section={location.pathname.endsWith('customers') ? 'customers' : 'projects'} settings={defaultSettings} onSettingsChange={() => {}} onSettingsReset={() => {}} settingsStatus="ready" settingsError={null} settingsPersistence="session" onSettingsRetry={() => {}} />;
    }
    let renderer!: ReactTestRenderer;
    await act(async () => { renderer = create(<ThemeProvider theme={darkTheme}><LanguageContext.Provider value={language}><MemoryRouter initialEntries={[route]}><WorkspaceContext.Provider value={workspace}><Host /></WorkspaceContext.Provider></MemoryRouter></LanguageContext.Provider></ThemeProvider>, { createNodeMock() { return { showModal() {}, close() {}, focus() {} }; } }); });
    return { get root() { return renderer.root; }, get details() { return details; }, get projects() { return projects; }, get url() { return url; }, workspace,
        async click(label: string) { const button = renderer.root.findAllByType('button').find(node => text(node) === label); assert(button, `Missing ${label}`); await act(async () => button.props.onClick({ stopPropagation() {} })); },
        async close() { await act(async () => renderer.unmount()); workspace.dispose(); } };
}
export const customerDetailsTests = [
    { name: 'Customer overview shows only name, industry and city; selecting a row opens its details', async run() {
        for (const language of ['de', 'en'] as const) {
            const ui = await fixture('/projectManager/customers', false, language); try {
                const table = ui.root.findByType('table');
                assert(table.findAllByType('th').filter(node => node.props.scope === 'col').map(text).join(',') === (language === 'de' ? 'Name,Branche,Ort' : 'Name,Industry,City'), 'The three column headings must be localized');
                const rows = table.findAllByType('tr').filter(node => node.props['data-customer']);
                assert(rows.length === 2 && text(rows[0]) === 'Customer oneITTown' && text(rows[1]) === 'Customer two——', 'Every customer must have one compact row, including missing values');
                assert(!text(ui.root).includes('First contact') && !text(ui.root).includes('one@example.test') && !text(ui.root).includes('Street 1') && !text(ui.root).includes('Customer one project'), 'Detailed cards must not be rendered before selection');
                assert(rows[0].findAllByType('button').length === 1, 'Each row must provide a native keyboard-accessible customer button');
                await act(async () => rows[0].props.onClick());
                assert(ui.url.includes('customer=1') && ui.root.findAllByType('table').length === 0 && text(ui.root).includes('First contact'), 'A row click must open the selected detail card');
            } finally { await ui.close(); }
        }
    } },
    { name: 'Customer table search retains all search fields and distinguishes an empty directory from no matches', async run() {
        const ui = await fixture(); try {
            const input = () => ui.root.findAllByType('input').find(node => node.props.type === 'search')!;
            const rows = () => ui.root.findByType('table').findAllByType('tr').filter(node => node.props['data-customer']);
            for (const query of [' customer ONE ', 'it', 'town', '01234', 'one@example.test']) {
                await act(async () => input().props.onChange({ target: { value: query } }));
                assert(rows().length === 1 && text(rows()[0]).includes('Customer one'), 'Search must match names, industry, city, postal code and email without opening details');
            }
            await act(async () => input().props.onChange({ target: { value: 'missing' } }));
            assert(rows().length === 0 && text(ui.root).includes('No customers match this search.') && text(ui.root).includes('0 of 2 customers'), 'A filter with no results needs a clear empty state');
            await act(async () => input().props.onChange({ target: { value: '' } }));
            assert(rows().length === 2 && !ui.url.includes('customer='), 'Clearing search must restore all rows without navigation');
            await act(async () => ui.workspace.update('projects', []));
            await act(async () => ui.workspace.update('customers', []));
            assert(text(ui.root).includes('No customers yet. Create your first customer.'), 'An empty directory needs its own message');
        } finally { await ui.close(); }
    } },
    { name: 'Customer deletion remains in the detail card with project protection and returns to the table after confirmation', async run() {
        const ui = await fixture('/projectManager/customers?customer=2&keep=x'); try {
            const remove = () => ui.root.findAllByType('button').find(node => text(node) === 'Delete customer')!;
            assert(remove().props.disabled && text(ui.root).includes('Before deleting this customer, reassign or delete their projects.'), 'Linked projects must prevent deletion');
            await act(async () => ui.workspace.update('projects', values => values.filter(value => value.customerId !== 2)));
            assert(!remove().props.disabled, 'Unlinked customers must remain deletable');
            await ui.click('Delete customer');
            assert(ui.workspace.getSnapshot().data!.customers.length === 2 && ui.root.findAllByType('dialog').length === 1, 'Deletion must require confirmation');
            await ui.click('Delete permanently');
            assert(!ui.url.includes('customer=') && ui.url.includes('keep=x') && ui.root.findAllByType('table').length === 1, 'Confirmed deletion must return to the directory and retain unrelated URL parameters');
            assert(ui.workspace.getSnapshot().data!.customers.length === 1 && !text(ui.root.findByType('table')).includes('Customer two'), 'Only the selected customer may be removed');
        } finally { await ui.close(); }
    } },
    { name: 'Kundentitel öffnet Detail-Direktlink mit ausschließlich eigenen Projekten und Kontakten', async run() {
        const ui = await fixture(); try {
            await ui.click('Customer one'); assert(ui.url.includes('customer=1'), 'Kunde muss direkt verlinkbar sein');
            const content = text(ui.root); assert(content.includes('First contact') && content.includes('Customer one project') && !content.includes('Other contact') && !content.includes('Other project'), 'Detailseite muss Kontakte/Projekte dem Kunden zuordnen');
            assert(content.includes('01234') && content.includes('<script>Existing note</script>') && ui.root.findAllByType('script').length === 0, 'Notizen müssen Text bleiben und PLZ erhalten');
            await ui.click('← Back to customers'); assert(!ui.url.includes('customer='), 'Zurück muss Kundenliste zeigen');
        } finally { await ui.close(); }
        const direct = await fixture('/projectManager/customers?customer=1&keep=x'); try { assert(text(direct.root).includes('First contact'), 'Direktlink muss funktionieren'); await direct.click('← Back to customers'); assert(direct.url.includes('keep=x'), 'Andere URL-Parameter müssen erhalten bleiben'); } finally { await direct.close(); }
    } },
    { name: 'Unbekannte Kundendirektlinks zeigen keinen anderen Kunden als Ersatz', async run() {
        const ui = await fixture('/projectManager/customers?customer=999'); try { assert(text(ui.root).includes('Customer not found.') && !text(ui.root).includes('First contact'), 'Fremde/fehlende Kennung darf keine anderen Details öffnen'); } finally { await ui.close(); }
    } },
    { name: 'Ansprechpartner und Notizen werden gezielt gespeichert; Stammdatenbearbeitung erhält beide Bereiche', async run() {
        const ui = await fixture('/projectManager/customers', true); try {
            await act(async () => ui.details.openContact(1)); await act(async () => ui.details.changeContact({ name: 'New contact', role: 'Support', email: 'new@example.test', phone: '' }));
            await act(async () => ui.details.saveContact());
            const customer = () => ui.workspace.getSnapshot().data!.customers.find(entry => entry.id === 1)!;
            assert(customer().contacts?.length === 2 && customer().contacts?.[1].id === 9, 'Neue ID muss alle vorhandenen Ansprechpartner berücksichtigen');
            await act(async () => ui.details.openNotes(1)); await act(async () => ui.details.changeNotes('  Notiz 😀\n')); await act(async () => ui.details.saveNotes());
            assert(customer().notes === '  Notiz 😀\n', 'Notizen müssen exakt erhalten bleiben');
            await act(async () => ui.projects.openCustomerEditor(customer()));
            await act(async () => ui.projects.changeCustomer({ ...ui.projects.customerEditor!.draft, name: 'Renamed', phone: '123', industry: 'IT' })); await act(async () => ui.projects.saveCustomer());
            assert(customer().name === 'Renamed' && customer().contacts?.length === 2 && customer().notes === '  Notiz 😀\n', 'Basisformular darf neue Details nicht entfernen');
            await act(async () => ui.details.removeContact(1, 9)); assert(customer().contacts?.length === 1 && ui.workspace.getSnapshot().data!.customers[1].contacts?.length === 1, 'Entfernen muss kundenbezogen bleiben');
        } finally { await ui.close(); }
    } },
    { name: 'Veraltete oder ungültige Kontakt-/Notizentwürfe überschreiben keine gespeicherten Daten', async run() {
        const ui = await fixture('/projectManager/customers', true); try {
            await act(async () => ui.details.openContact(1)); await act(async () => ui.details.changeContact({ name: 'Invalid', role: '', email: 'invalid', phone: '' })); await act(async () => ui.details.saveContact());
            assert(ui.details.error && ui.workspace.getSnapshot().data!.customers[0].contacts?.length === 1, 'Ungültige E-Mail darf nicht gespeichert werden');
            await act(async () => ui.details.closeContact()); await act(async () => ui.details.openNotes(1)); await act(async () => ui.details.changeNotes('Draft'));
            await act(async () => ui.workspace.update('customers', ui.workspace.getSnapshot().data!.customers.map(customer => customer.id === 1 ? { ...customer, notes: 'Changed externally' } : customer)));
            await act(async () => ui.details.saveNotes()); assert(ui.details.error && ui.workspace.getSnapshot().data!.customers[0].notes === 'Changed externally', 'Staler Entwurf darf externe Notiz nicht überschreiben');
            await act(async () => ui.details.closeNotes());
            const original = ui.workspace.getSnapshot().data!.customers[0].contacts![0]; await act(async () => ui.details.openContact(1, original));
            await act(async () => ui.details.changeContact({ ...original, name: 'Stale contact' }));
            await act(async () => ui.workspace.update('customers', ui.workspace.getSnapshot().data!.customers.map(customer => customer.id === 1 ? { ...customer, contacts: [{ ...original, name: 'Updated contact' }] } : customer)));
            await act(async () => ui.details.saveContact()); assert(ui.details.error && ui.workspace.getSnapshot().data!.customers[0].contacts![0].name === 'Updated contact', 'Staler Kontaktentwurf darf externe Änderung nicht überschreiben');
        } finally { await ui.close(); }
    } },
    { name: 'KI-Kontaktkarten erlauben Geschäftsfunktion, aber keine Rechte oder Kundenzuordnungsänderung', run() {
        const action = { id: '11111111-1111-4111-8111-111111111111', type: 'workspace.create', entity: 'contacts', data: { id: 1, customerId: 1, name: 'Contact', role: 'Manager', email: '', phone: '' }, revision: '1', expiresAt: '2099-01-01T00:00:00Z', status: 'proposed', resultRevision: null };
        assert(isWorkspaceMutation(action) && !isWorkspaceMutation({ ...action, data: { ...action.data, administrator: true } }), 'Geschäftsfunktion darf keine Kontoberechtigung werden');
        assert(!isWorkspaceMutation({ ...action, type: 'workspace.update', data: { id: 1, customerId: 2 }, before: { customerId: 1 } }), 'Bestätigte Kontaktänderung darf den Kunden nicht austauschen');
    } }
];

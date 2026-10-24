import { useState } from 'react';
import { act, create } from 'react-test-renderer';
import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { ThemeProvider } from 'styled-components';
import { darkTheme } from '../../../styles/theme';
import { LanguageContext } from '../../../hooks/languageContext';
import { AuthContext } from '../../../hooks/authContext';
import { GlobalSettingsContext } from '../../../hooks/globalSettingsContext';
import { createAuthStore } from '../../../services/auth/authStore';
import { createApiClient } from '../../../services/api/apiClient';
import { createGlobalSettingsStore, createSessionGlobalSettingsRepository } from '../../../services/settings/globalSettings';
import type { CustomerDraft } from '../types/project.types';
import CustomerModal from './CustomerModal';
import GlobalIndustrySettings from './GlobalIndustrySettings';

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const text = (node: ReactTestInstance): string => node.children.map(child => typeof child === 'string' ? child : text(child)).join('');
async function fixture(administrator = true, editing = false, industry = 'IT & Software') {
    const auth = createAuthStore(createApiClient('/api/v1', async () => new Response(JSON.stringify({ user: { id: 'test-user', name: 'Test', email: 'test@example.test', administrator }, csrfToken: 'test-token' }))), true);
    await auth.refresh(); const catalog = createGlobalSettingsStore(createSessionGlobalSettingsRepository()); await catalog.load();
    let current: CustomerDraft = { name: 'Example', street: 'Street 1', postalCode: '01234', city: 'Town', country: 'Deutschland', email: 'test@example.test', phone: '+49 1234', industry }; let saves = 0;
    function Host() { const [draft, setDraft] = useState(current); current = draft; return <><GlobalIndustrySettings /><CustomerModal draft={draft} isEditing={editing} error="" onChange={setDraft} onSave={() => { saves++; }} onClose={() => {}} /></>; }
    let renderer!: ReactTestRenderer;
    await act(async () => { renderer = create(<ThemeProvider theme={darkTheme}><LanguageContext.Provider value="en"><AuthContext.Provider value={auth}><GlobalSettingsContext.Provider value={catalog}><Host /></GlobalSettingsContext.Provider></AuthContext.Provider></LanguageContext.Provider></ThemeProvider>); });
    return { get root() { return renderer.root; }, catalog, get current() { return current; }, get saves() { return saves; }, async close() { await act(async () => renderer.unmount()); catalog.dispose(); auth.dispose(); } };
}
export const customerFormTests = [
    { name: 'Kundenformular gliedert Unternehmen, Anschrift und Kontakt und erhält internationale PLZ als Text', async run() {
        const ui = await fixture(); try {
            assert(ui.root.findAllByType('legend').map(text).join(',') === 'Company,Address,Contact', 'Formularbereiche müssen übersetzt und gegliedert sein');
            const postal = ui.root.findAllByType('input').find(node => node.props.name === 'postalCode')!;
            assert(postal.props.type === 'text' && postal.props.autoComplete === 'postal-code' && postal.props.value === '01234' && postal.props.required, 'PLZ benötigt Text, Pflichtfeld und Autocomplete');
            await act(async () => postal.props.onChange({ target: { value: 'SW1A 1AA' } })); assert(ui.current.postalCode === 'SW1A 1AA', 'Internationale PLZ muss unverändert bleiben');
            const select = ui.root.findByType('select'); assert(select.props.name === 'industry' && ui.root.findAllByType('input').every(node => node.props.name !== 'industry'), 'Branche muss ein echtes Dropdown sein');
            await act(async () => ui.root.findByType('form').props.onSubmit({ preventDefault() {} })); assert(ui.saves === 1, 'Speichern muss explizit erfolgen');
        } finally { await ui.close(); }
    } },
    { name: 'Globale Branchenänderungen aktualisieren das Kunden-Dropdown ohne bestehende Kundenwerte zu löschen', async run() {
        const ui = await fixture(true, true, 'Existing legacy industry'); try {
            const legacy = ui.root.findAllByType('option').find(node => node.props.value === 'Existing legacy industry');
            assert(legacy && text(legacy).includes('Previous value') && ui.current.industry === 'Existing legacy industry', 'Entfernte Branchen dürfen Kunden nicht ändern');
            const first = ui.root.findAllByType('input').find(node => node.props['aria-label'] === 'Industry 1')!;
            await act(async () => first.props.onChange({ target: { value: 'Updated global industry' } }));
            assert(!ui.root.findAllByType('option').some(node => node.props.value === 'Updated global industry'), 'Ungespeicherter Entwurf darf Dropdown nicht ändern');
            const save = ui.root.findAllByType('button').find(node => text(node) === 'Save industry list')!;
            await act(async () => save.props.onClick());
            assert(ui.root.findAllByType('option').some(node => node.props.value === 'Updated global industry') && ui.current.industry === 'Existing legacy industry', 'Gespeicherte globale Liste muss Dropdown aktualisieren und Altwert erhalten');
        } finally { await ui.close(); }
    } },
    { name: 'Normale Nutzer sehen den Branchenkatalog ohne Verwaltungsaktionen', async run() {
        const ui = await fixture(false); try {
            const industry = ui.root.findAllByType('input').find(node => node.props['aria-label'] === 'Industry 1')!;
            assert(industry.props.readOnly && !ui.root.findAllByType('button').some(node => ['Save industry list', 'Add industry', 'Remove'].includes(text(node))), 'Nur Administratoren dürfen Branchen ändern');
            assert(!ui.root.findByType('select').props.disabled, 'Normale Nutzer müssen Branchen weiterhin auswählen können');
        } finally { await ui.close(); }
    } }
];

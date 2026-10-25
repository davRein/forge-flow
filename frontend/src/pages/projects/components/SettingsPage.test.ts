import { createElement, useState } from 'react';
import { act, create } from 'react-test-renderer';
import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import SettingsPage from './SettingsPage';
import { AuthContext } from '../../../hooks/authContext';
import { WorkspaceContext } from '../../../hooks/workspaceContext';
import { LanguageContext } from '../../../hooks/languageContext';
import { defaultSettings } from '../../../config/appSettings';
import { darkTheme } from '../../../styles/theme';
import { createApiClient } from '../../../services/api/apiClient';
import { createAuthStore } from '../../../services/auth/authStore';
import { createWorkspaceStore } from '../../../services/workspace/workspaceStore';
import type { AppSettings } from '../../../types/settings.types';

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function text(node: ReactTestInstance): string { return node.children.map((child) => typeof child === 'string' ? child : text(child)).join(''); }
function visible(node: ReactTestInstance): boolean { return !node.props.hidden && (!node.parent || visible(node.parent)); }

async function fixture(initial = '/projectManager/settings', initialSettings: AppSettings = { ...defaultSettings, language: 'de' }, saveError = false) {
    const auth = createAuthStore(createApiClient('/api/v1', async () => new Response(JSON.stringify({
        user: { id: 'settings-test', name: 'Test User', email: 'test@example.test', administrator: false }, csrfToken: 'test-token'
    }))), true);
    await auth.refresh();
    const workspace = createWorkspaceStore({ persistence: 'account',
        async load() { return { revision: '1', data: { projects: [], customers: [], tasks: [], activities: [], epics: [], sprints: [], files: [], wiki: { articles: [], categories: [] } } }; },
        async save() { return '2'; }
    });
    await workspace.load();
    let current = initialSettings;
    let url = '';
    let retries = 0;
    function Host() {
        const [settings, setSettings] = useState(initialSettings);
        current = settings;
        const location = useLocation();
        url = location.pathname + location.search;
        return createElement(LanguageContext.Provider, { value: settings.language }, createElement(SettingsPage, {
            settings, onChange: setSettings, onReset: () => setSettings({ ...defaultSettings }),
            status: 'ready', error: saveError ? { operation: 'save', message: 'Die Änderungen sind aktiv, konnten aber nicht gespeichert werden. Bitte erneut versuchen.' } : null,
            persistence: 'account', onRetry() { retries++; }
        }));
    }
    let renderer!: ReactTestRenderer;
    await act(async () => {
        renderer = create(createElement(ThemeProvider, { theme: darkTheme },
            createElement(AuthContext.Provider, { value: auth },
                createElement(WorkspaceContext.Provider, { value: workspace },
                    createElement(MemoryRouter, { initialEntries: [initial] }, createElement(Host))))));
    });
    return { get root() { return renderer.root; }, getSettings: () => current, getRetries: () => retries, get url() { return url; },
        async click(label: string) {
            const link = renderer.root.findAllByType('a').find((node) => text(node) === label);
            assert(link, `Menüpunkt ${label} fehlt`);
            await act(async () => link.props.onClick({ button: 0, defaultPrevented: false, preventDefault() {}, metaKey: false, altKey: false, ctrlKey: false, shiftKey: false }));
        },
        async close() { await act(async () => renderer.unmount()); auth.dispose(); workspace.dispose(); }
    };
}

export const settingsPageTests = [
    { name: 'Four accessible appearance choices apply Aurora and Dune immediately in both languages', async run() {
        for (const language of ['de', 'en'] as const) {
            const ui = await fixture('/projectManager/settings', { ...defaultSettings, language, defaultTaskPriority: 'high' });
            try {
                const choices = () => ui.root.findAllByType('input').filter((node) => visible(node) && node.props.name === 'theme-mode');
                assert(choices().length === 4, 'All four themes need native radio controls');
                for (const themeMode of ['aurora', 'dune'] as const) {
                    await act(async () => choices().find((node) => node.props.value === themeMode)!.props.onChange());
                    assert(ui.getSettings().themeMode === themeMode, 'Theme selection must apply immediately');
                    assert(ui.getSettings().language === language && ui.getSettings().defaultTaskPriority === 'high', 'Other preferences must remain unchanged');
                    assert(choices().filter((node) => node.props.checked).length === 1 && choices().find((node) => node.props.value === themeMode)!.props.checked, 'Only the current theme may be selected');
                }
                const descriptions = ui.root.findAllByType('small').map(text);
                assert(descriptions.includes(language === 'en' ? 'Sand and terracotta' : 'Sand und Terrakotta'), 'Palette descriptions must follow the selected language');
            } finally { await ui.close(); }
        }
    } },
    { name: 'Speicherfehler lassen sich auch aus der Nutzerverwaltung wiederholen', async run() {
        const ui = await fixture('/projectManager/settings?category=users', { ...defaultSettings, language: 'de' }, true);
        try {
            const retry = ui.root.findAllByType('button').find((node) => visible(node) && text(node) === 'Erneut speichern');
            assert(retry, 'Wiederholen darf im Nutzerbereich nicht verschwinden');
            await act(async () => retry.props.onClick());
            assert(ui.getRetries() === 1, 'Wiederholen muss an den Einstellungsspeicher weitergegeben werden');
        } finally { await ui.close(); }
    } },
    { name: 'Einstellungsmenü bietet vier Bereiche und startet mit Optik', async run() {
        const ui = await fixture();
        try {
            const links = ui.root.findAllByType('a');
            assert(links.map(text).join(',') === 'Nutzerverwaltung,Optik,Projektmanager,Sprache,Globale Einstellungen', 'Persönliche und globale Einstellungsbereiche müssen vorhanden sein');
            assert(text(links.find((node) => node.props['aria-current'] === 'page')!) === 'Optik', 'Optik ist die Standardauswahl');
            assert(ui.root.findAllByType('input').filter(visible).every((node) => node.props.type === 'radio'), 'Nur Darstellungseinstellungen dürfen sichtbar sein');
            assert(ui.root.findAllByType('select').filter(visible).length === 0, 'Projektmanager-Vorgaben gehören in einen eigenen Bereich');
        } finally { await ui.close(); }
    } },
    { name: 'Menüwechsel speichert Auswahl in der URL und erhält andere Parameter', async run() {
        const ui = await fixture('/projectManager/settings?other=keep');
        try {
            await ui.click('Projektmanager');
            assert(ui.url.includes('category=projects') && ui.url.includes('other=keep'), 'Kategorie und fremde Parameter müssen erhalten bleiben');
            assert(ui.root.findAllByType('select').filter(visible).length === 2, 'Projektmanager benötigt Startansicht und Aufgabenpriorität');
            await ui.click('Sprache');
            assert(ui.root.findAllByType('select').filter(visible).length === 1, 'Sprachbereich zeigt nur die Sprachauswahl');
        } finally { await ui.close(); }
    } },
    { name: 'Kontoeingaben bleiben beim Wechsel der Einstellungsbereiche erhalten', async run() {
        const ui = await fixture('/projectManager/settings?category=users');
        try {
            const profile = () => ui.root.findAllByType('form').find((node) => node.props['aria-label'] === 'Mein Profil')!;
            await act(async () => profile().findAllByType('input')[0].props.onChange({ target: { value: 'Angefangener Entwurf' } }));
            await ui.click('Optik');
            assert(!visible(profile()), 'Kontoformular muss im Optikbereich ausgeblendet sein');
            await ui.click('Nutzerverwaltung');
            assert(profile().findAllByType('input')[0].props.value === 'Angefangener Entwurf', 'Menüwechsel darf den Entwurf nicht verwerfen');
        } finally { await ui.close(); }
    } },
    { name: 'Sprachwechsel übersetzt Einstellungen sofort und erhält andere Vorgaben', async run() {
        const ui = await fixture('/projectManager/settings?category=language', { ...defaultSettings, language: 'de', defaultTaskPriority: 'high' });
        try {
            await act(async () => ui.root.findAllByType('select').filter(visible)[0].props.onChange({ target: { value: 'en' } }));
            assert(ui.getSettings().language === 'en' && ui.getSettings().defaultTaskPriority === 'high', 'Sprachwechsel darf andere Vorgaben nicht ändern');
            assert(ui.root.findAllByType('a').map(text).join(',') === 'User management,Appearance,Project manager,Language,Global settings', 'Menü muss sofort Englisch anzeigen');
            await ui.click('User management');
            assert(ui.root.findAllByType('h2').filter(visible).some((node) => text(node) === 'Change password'), 'Auch Kontoformulare müssen übersetzt sein');
            await ui.click('Language');
            const reset = ui.root.findAllByType('button').find((node) => visible(node) && text(node) === 'Reset all settings');
            assert(reset && !reset.props.disabled, 'Zurücksetzen muss für geänderte Sprache möglich sein');
            await act(async () => reset.props.onClick());
            assert(ui.getSettings().language === 'en' && ui.getSettings().defaultTaskPriority === 'medium', 'Zurücksetzen muss Vorgaben einschließlich Englisch wiederherstellen');
        } finally { await ui.close(); }
    } },
    { name: 'Ungültige Einstellungskategorie fällt auf Optik zurück', async run() {
        const ui = await fixture('/projectManager/settings?category=unknown');
        try {
            assert(ui.root.findAllByType('a').some((node) => node.props['aria-current'] === 'page' && text(node) === 'Optik'), 'Ungültige Direktlinks müssen einen gültigen Bereich anzeigen');
        } finally { await ui.close(); }
    } }
];

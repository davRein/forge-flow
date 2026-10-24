import { createElement } from 'react';
import { act, create } from 'react-test-renderer';
import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { ThemeProvider } from 'styled-components';
import AccountSettings from './AccountSettings';
import { AuthContext } from '../../../hooks/authContext';
import { WorkspaceContext } from '../../../hooks/workspaceContext';
import { createApiClient } from '../../../services/api/apiClient';
import { createAuthStore } from '../../../services/auth/authStore';
import { createWorkspaceStore } from '../../../services/workspace/workspaceStore';
import { darkTheme } from '../../../styles/theme';
import { LanguageContext } from '../../../hooks/languageContext';

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function text(node: ReactTestInstance): string {
    return node.children.map((child) => typeof child === 'string' ? child : text(child)).join('');
}

type Options = { write?: (path: string) => Promise<Response>; list?: () => Promise<Response>; pending?: boolean };
async function fixture(options: Options = {}) {
    const writes: string[] = [];
    const focused: string[] = [];
    const client = createApiClient('/api/v1', async (url, init) => {
        const path = String(url).replace('/api/v1', '');
        if (init?.method && init.method !== 'GET') {
            writes.push(path);
            assert(new Headers(init.headers).get('X-CSRF-Token') === 'test-csrf', 'Änderungen benötigen CSRF');
            return options.write ? options.write(path) : new Response(null, { status: 204 });
        }
        if (path === '/users') return options.list ? options.list() : new Response('[]');
        return new Response(JSON.stringify({ user: { id: 'test-admin', name: 'Test Admin', email: 'admin@example.test', administrator: true }, csrfToken: 'test-csrf' }));
    });
    const auth = createAuthStore(client, true);
    await auth.refresh();
    const workspace = createWorkspaceStore({ persistence: 'account',
        async load() { return { revision: '1', data: { projects: [], customers: [], tasks: [], activities: [], epics: [], sprints: [], files: [], wiki: { articles: [], categories: [] } } }; },
        async save() { return '2'; }
    });
    await workspace.load();
    let renderer!: ReactTestRenderer;
    await act(async () => {
        renderer = create(createElement(ThemeProvider, { theme: darkTheme },
            createElement(AuthContext.Provider, { value: auth },
                createElement(WorkspaceContext.Provider, { value: workspace },
                    createElement(LanguageContext.Provider, { value: 'de' },
                        createElement(AccountSettings, { unsavedSettings: options.pending ?? false, client }))))), {
            createNodeMock(element) { return { focus() { focused.push(String(element.props.id)); } }; }
        });
    });
    const form = (title: string) => {
        const result = renderer.root.findAllByType('form').find((entry) => entry.findAllByType('h2').some((heading) => text(heading) === title));
        assert(result, `Formular ${title} fehlt`);
        return result;
    };
    return { auth, writes, focused, form,
        async fill(title: string, values: string[]) {
            await act(async () => form(title).findAllByType('input').forEach((input, index) => input.props.onChange({ target: { value: values[index] } })));
        },
        async submit(title: string) { await act(async () => { form(title).props.onSubmit({ preventDefault() {} }); }); },
        async close() { await act(async () => renderer.unmount()); auth.dispose(); workspace.dispose(); }
    };
}

function alert(form: ReactTestInstance): ReactTestInstance {
    const found = form.findAll((node) => node.type === 'p' && node.props.role === 'alert');
    assert(found.length === 1, 'Genau eine Fehlermeldung muss direkt im abgesendeten Formular stehen');
    return found[0];
}

export const accountFormTests = [
    { name: 'Benutzerformular zeigt kurze Passwörter vor Ort und fokussiert auch wiederholte Fehler', async run() {
        const ui = await fixture();
        try {
            await ui.fill('Benutzer anlegen', ['Test', 'test@example.test', 'zu-kurz', 'zu-kurz']);
            await ui.submit('Benutzer anlegen');
            assert(text(alert(ui.form('Benutzer anlegen'))).includes('mindestens 12'), 'Passwortrichtlinie muss sichtbar sein');
            const count = ui.focused.length;
            await ui.submit('Benutzer anlegen');
            assert(ui.focused.length === count + 1, 'Wiederholter Fehler muss erneut fokussiert werden');
            assert(ui.writes.length === 0, 'Ungültige Passwörter dürfen nicht gesendet werden');
        } finally { await ui.close(); }
    } },
    { name: 'Benutzerformular zeigt abweichende Bestätigung ohne API-Aufruf', async run() {
        const ui = await fixture();
        try {
            await ui.fill('Benutzer anlegen', ['Test', 'test@example.test', 'Testpasswort-12345', 'anderes-Passwort']);
            await ui.submit('Benutzer anlegen');
            assert(text(alert(ui.form('Benutzer anlegen'))).includes('nicht überein'), 'Bestätigungsfehler fehlt am Formular');
            assert(ui.writes.length === 0, 'Abweichende Bestätigung darf nicht gesendet werden');
        } finally { await ui.close(); }
    } },
    { name: 'Benutzerformular zeigt API-Fehler lokal und erhält Eingaben', async run() {
        const ui = await fixture({ write: async () => new Response('{"error":{"message":"E-Mail bereits vergeben"}}', { status: 409 }) });
        try {
            await ui.fill('Benutzer anlegen', ['Test', 'test@example.test', 'Testpasswort-12345', 'Testpasswort-12345']);
            await ui.submit('Benutzer anlegen');
            assert(text(alert(ui.form('Benutzer anlegen'))) === 'E-Mail bereits vergeben', 'Serverfehler muss am Formular stehen');
            assert(ui.form('Benutzer anlegen').findAllByType('input')[2].props.value === 'Testpasswort-12345', 'Passwort muss korrigierbar bleiben');
            assert(ui.writes.join(',') === '/users', 'Benutzer-Anfrage fehlt');
        } finally { await ui.close(); }
    } },
    { name: 'Benutzerformular zeigt laufende Anfrage und bestätigten Erfolg', async run() {
        let finish!: (response: Response) => void;
        const ui = await fixture({ write: () => new Promise((resolve) => { finish = resolve; }) });
        try {
            await ui.fill('Benutzer anlegen', ['Test', 'test@example.test', 'Testpasswort-12345', 'Testpasswort-12345']);
            await ui.submit('Benutzer anlegen');
            const button = ui.form('Benutzer anlegen').findByType('button');
            assert(button.props.disabled && text(button).includes('wird angelegt'), 'Laufender Vorgang muss erkennbar sein');
            await act(async () => finish(new Response(JSON.stringify({ id: 'test-user', name: 'Test', email: 'test@example.test', administrator: false, active: true }))));
            assert(ui.form('Benutzer anlegen').findAllByType('p').some((node) => node.props.role === 'status' && text(node).includes('angelegt')), 'Erfolg fehlt am Formular');
            assert(ui.form('Benutzer anlegen').findAllByType('input').every((input) => input.props.value === ''), 'Erfolgreiche Anlage muss Felder leeren');
        } finally { await ui.close(); }
    } },
    { name: 'Späte Kontoliste entfernt keinen Validierungsfehler aus dem Benutzerformular', async run() {
        let finish!: (response: Response) => void;
        const ui = await fixture({ list: () => new Promise((resolve) => { finish = resolve; }) });
        try {
            await ui.fill('Benutzer anlegen', ['Test', 'test@example.test', 'zu-kurz', 'zu-kurz']);
            await ui.submit('Benutzer anlegen');
            await act(async () => finish(new Response('[]')));
            assert(text(alert(ui.form('Benutzer anlegen'))).includes('mindestens 12'), 'Kontoladen darf Formularfehler nicht entfernen');
        } finally { await ui.close(); }
    } },
    { name: 'Passwortformular zeigt API-Fehler und meldet erst nach Erfolg ab', async run() {
        let fail = true;
        const ui = await fixture({ write: async () => fail ? new Response('{"error":{"message":"Aktuelles Passwort falsch"}}', { status: 400 }) : new Response(null, { status: 204 }) });
        try {
            await ui.fill('Passwort ändern', ['Test-Altpasswort', 'Testpasswort-12345', 'Testpasswort-12345']);
            await ui.submit('Passwort ändern');
            assert(text(alert(ui.form('Passwort ändern'))) === 'Aktuelles Passwort falsch', 'Passwortfehler fehlt am Formular');
            assert(ui.auth.getSnapshot().status === 'authenticated', 'Fehler darf nicht abmelden');
            fail = false;
            await ui.submit('Passwort ändern');
            assert(ui.auth.getSnapshot().status === 'anonymous' && ui.auth.getSnapshot().notice?.includes('Passwort geändert'), 'Erfolg muss erneute Anmeldung verlangen');
        } finally { await ui.close(); }
    } },
    { name: 'Profilformular zeigt API-Fehler direkt neben dem Speichern', async run() {
        const ui = await fixture({ write: async () => new Response('{"error":{"message":"Profil konnte nicht gespeichert werden"}}', { status: 503 }) });
        try {
            await ui.fill('Mein Profil', ['Neuer Name', 'admin@example.test']);
            await ui.submit('Mein Profil');
            assert(text(alert(ui.form('Mein Profil'))).includes('nicht gespeichert'), 'Profilfehler fehlt am Formular');
        } finally { await ui.close(); }
    } },
    { name: 'Blockierte Kontoformulare erklären den Grund lokal', async run() {
        const ui = await fixture({ pending: true });
        try {
            for (const title of ['Mein Profil', 'Passwort ändern', 'Benutzer anlegen']) {
                assert(ui.form(title).findAllByType('button').every((button) => button.props.disabled), 'Ungespeicherte Änderungen müssen Aktionen blockieren');
                assert(ui.form(title).findAllByType('p').some((node) => node.props.role === 'status' && text(node).includes('ausstehende Änderungen')), 'Grund fehlt am blockierten Formular');
            }
        } finally { await ui.close(); }
    } }
];

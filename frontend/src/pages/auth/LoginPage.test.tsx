import { act, create } from 'react-test-renderer';
import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import type { ReactElement } from 'react';
import { ThemeProvider } from 'styled-components';
import { AuthContext } from '../../hooks/authContext';
import { useAppSettings } from '../../hooks/useAppSettings';
import { createAuthStore } from '../../services/auth/authStore';
import { createApiClient } from '../../services/api/apiClient';
import { getBrowserLanguage, rememberBrowserLanguage } from '../../services/i18n/browserLanguage';
import type { SettingsRepository } from '../../services/settings/settingsRepository';
import { defaultSettings } from '../../config/appSettings';
import { darkTheme } from '../../styles/theme';
import LanguageProvider from '../../components/LanguageProvider';
import LoginPage from './LoginPage';

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const text = (node: ReactTestInstance): string => node.children.map(child => typeof child === 'string' ? child : text(child)).join('');

async function fixture() {
    const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
    const values = new Map<string, string>();
    const documentState = { documentElement: { lang: '' } };
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: {
        getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }
    } } });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: documentState });
    const auth = createAuthStore(createApiClient('/api/v1', async (url) => String(url).endsWith('/auth/csrf')
        ? new Response(JSON.stringify({ csrfToken: 'test-token' }))
        : new Response(JSON.stringify({ error: { code: 'INVALID_CREDENTIALS', message: 'E-Mail oder Passwort ist falsch.' } }), { status: 401 })), true);
    let renderer: ReactTestRenderer | undefined;
    return {
        auth, values, documentState,
        get root() { return renderer!.root; },
        async render(child: ReactElement) {
            const tree = <ThemeProvider theme={darkTheme}><AuthContext.Provider value={auth}>{child}</AuthContext.Provider></ThemeProvider>;
            await act(async () => { if (renderer) renderer.update(tree); else renderer = create(tree); });
        },
        async unmount() { await act(async () => renderer?.unmount()); renderer = undefined; },
        async close() {
            await act(async () => renderer?.unmount()); auth.dispose();
            if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow); else Reflect.deleteProperty(globalThis, 'window');
            if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument); else Reflect.deleteProperty(globalThis, 'document');
        }
    };
}

export const loginLanguageTests = [
    { name: 'Geladene englische Kontosprache bleibt nach Abmeldung auf dem vollständigen Login erhalten', async run() {
        const ui = await fixture();
        const repository: SettingsRepository = { persistence: 'account', async load() { return { version: 1, settings: { ...defaultSettings, language: 'en' } }; }, async save() {} };
        function Account() {
            const state = useAppSettings({ userId: 'test-account', repository });
            return <LanguageProvider language={state.settings.language}><p>{state.status}</p></LanguageProvider>;
        }
        try {
            rememberBrowserLanguage('de');
            await ui.render(<Account />);
            assert(ui.values.get('forgeflow.language') === 'en', 'Loaded account choice must be remembered');
            await ui.unmount();
            await ui.render(<LanguageProvider language={getBrowserLanguage()}><LoginPage /></LanguageProvider>);
            assert(text(ui.root).includes('Checking your session'), 'Session check must use remembered language');
            await act(async () => ui.auth.refresh());
            const content = text(ui.root);
            assert(content.includes('Sign in to ForgeFlow') && content.includes('Password') && content.includes('Email'), 'Login labels must be English');
            assert(ui.documentState.documentElement.lang === 'en', 'Document language must match login');
            await act(async () => ui.auth.login('test@example.test', 'test-only-password'));
            assert(text(ui.root).includes('Email or password is incorrect.'), 'Sign-in errors must be translated');
        } finally { await ui.close(); }
    } },
    { name: 'Manueller Sprachwechsel bleibt auch bei fehlgeschlagener Kontospeicherung für den Login erhalten', async run() {
        const ui = await fixture();
        const repository: SettingsRepository = { persistence: 'account', async load() { return null; }, async save() { throw new Error('offline'); } };
        let settings!: ReturnType<typeof useAppSettings>;
        function Account() { settings = useAppSettings({ userId: 'test-account', repository }); return <LanguageProvider language={settings.settings.language}><p>{settings.status}</p></LanguageProvider>; }
        try {
            rememberBrowserLanguage('de'); await ui.render(<Account />);
            assert(settings.settings.language === 'de', 'Initial remembered language missing');
            await act(async () => settings.updateSettings({ ...settings.settings, language: 'en' }));
            assert(settings.error?.operation === 'save' && ui.values.get('forgeflow.language') === 'en', 'Local choice must survive account save failure');
            await ui.unmount(); await act(async () => ui.auth.refresh());
            await ui.render(<LanguageProvider language={getBrowserLanguage()}><LoginPage /></LanguageProvider>);
            assert(text(ui.root).includes('Sign in to ForgeFlow'), 'Login must retain the manual choice');
            await ui.render(<LanguageProvider language="de"><LoginPage /></LanguageProvider>);
            assert(text(ui.root).includes('Bei ForgeFlow anmelden') && ui.documentState.documentElement.lang === 'de', 'German login and document language must remain supported');
        } finally { await ui.close(); }
    } }
];

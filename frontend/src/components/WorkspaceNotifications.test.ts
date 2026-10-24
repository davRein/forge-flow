import { createElement } from 'react';
import { act, create } from 'react-test-renderer';
import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { ThemeProvider } from 'styled-components';
import WorkspaceNotifications from './WorkspaceNotifications';
import { WorkspaceContext } from '../hooks/workspaceContext';
import { LanguageContext } from '../hooks/languageContext';
import { createWorkspaceStore } from '../services/workspace/workspaceStore';
import { emptyWorkspace } from '../services/workspace/workspaceSchema';
import type { WorkspaceRepository } from '../services/workspace/workspaceTypes';
import type { AppLanguage } from '../types/settings.types';
import { darkTheme } from '../styles/theme';

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
// Only the timer surface used by these tests; Node-specific types stay out of the browser build.
type TimerTestContext = { mock: { timers: { enable(options: { apis: ['setTimeout'] }): void; tick(milliseconds: number): void } } };
function text(node: ReactTestInstance): string { return node.children.map((child) => typeof child === 'string' ? child : text(child)).join(''); }
async function fixture(options: { persistence?: 'account' | 'session'; save?: WorkspaceRepository['save'] } = {}) {
    let loads = 0;
    const store = createWorkspaceStore({ persistence: options.persistence ?? 'account',
        async load() { loads++; return { data: { ...emptyWorkspace(), files: [] }, revision: '1' }; },
        save: options.save ?? (async () => '2') });
    await store.load();
    let renderer!: ReactTestRenderer;
    const tree = (language: AppLanguage) => createElement(ThemeProvider, { theme: darkTheme },
        createElement(LanguageContext.Provider, { value: language },
            createElement(WorkspaceContext.Provider, { value: store }, createElement(WorkspaceNotifications))));
    await act(async () => { renderer = create(tree('de')); });
    return { store, get root() { return renderer.root; }, get loads() { return loads; },
        async language(language: AppLanguage) { await act(async () => renderer.update(tree(language))); },
        async edit() { await act(async () => store.update('tasks', [])); },
        async click(label: string) {
            const button = renderer.root.findAllByType('button').find((node) => text(node) === label || node.props['aria-label'] === label);
            assert(button, `Aktion ${label} fehlt`);
            await act(async () => button.props.onClick());
        },
        async close() { await act(async () => renderer.unmount()); store.dispose(); }
    };
}

export const notificationTests = [
    { name: 'Nur bestätigte Änderungen zeigen einen übersetzten Erfolg, der nach fünf Sekunden verschwindet', async run(context: TimerTestContext) {
        context.mock.timers.enable({ apis: ['setTimeout'] });
        const view = await fixture();
        try {
            assert(text(view.root) === '', 'Initiales Laden muss ohne dauerhaftes Statusfeld bleiben');
            await view.edit();
            assert(text(view.root).includes('Änderungen gespeichert.'), 'Speichern muss bestätigt werden');
            act(() => context.mock.timers.tick(4000));
            await view.language('en');
            assert(text(view.root).includes('Changes saved.'), 'Hinweis muss der aktuellen Sprache folgen');
            act(() => context.mock.timers.tick(1000));
            assert(text(view.root) === '', 'Sprachwechsel darf die Anzeigezeit nicht neu starten');
        } finally { await view.close(); }
    } },
    { name: 'Erfolgshinweise pausieren bei Maus und Tastaturfokus und können geschlossen werden', async run(context: TimerTestContext) {
        context.mock.timers.enable({ apis: ['setTimeout'] });
        const view = await fixture();
        try {
            await view.edit();
            const card = view.root.findAllByType('div').find((node) => node.props.onMouseEnter);
            assert(card, 'Hinweiskarte fehlt');
            act(() => card.props.onMouseEnter());
            act(() => context.mock.timers.tick(10000));
            assert(text(view.root).includes('gespeichert'), 'Mauskontakt muss den Timer anhalten');
            act(() => { card.props.onFocus(); card.props.onMouseLeave(); });
            act(() => context.mock.timers.tick(10000));
            assert(text(view.root).includes('gespeichert'), 'Tastaturfokus muss den Timer anhalten');
            act(() => card.props.onBlur({ currentTarget: { contains: () => false }, relatedTarget: null }));
            act(() => context.mock.timers.tick(5000));
            assert(text(view.root) === '', 'Nach dem Verlassen muss der Hinweis verschwinden');
            await view.edit();
            await view.click('Benachrichtigung schließen');
            assert(text(view.root) === '', 'Manuelles Schließen muss funktionieren');
        } finally { await view.close(); }
    } },
    { name: 'Speicherfehler bleiben mit Ursache sichtbar und können erfolgreich wiederholt werden', async run(context: TimerTestContext) {
        context.mock.timers.enable({ apis: ['setTimeout'] });
        let calls = 0;
        const view = await fixture({ save: async () => { if (++calls === 1) throw new Error('Die Anfrage ist zu groß.'); return '2'; } });
        try {
            await view.language('en'); await view.edit();
            const alert = view.root.findAllByType('div').find((node) => node.props.role === 'alert');
            assert(alert && text(alert).includes('The request is too large.'), 'Fehlerursache muss übersetzt im Alarm stehen');
            assert(!text(view.root).includes('Changes saved.'), 'Ein Fehler darf keinen Erfolg anzeigen');
            act(() => context.mock.timers.tick(60000));
            assert(text(view.root).includes('Could not save changes'), 'Fehler dürfen nicht automatisch verschwinden');
            await view.click('Retry saving');
            assert(calls === 2 && text(view.root).includes('Changes saved.'), 'Erfolgreiches Wiederholen muss den Fehler ersetzen');
        } finally { await view.close(); }
    } },
    { name: 'Versionskonflikte erlauben Laden erst nach Bestätigung und niemals blindes Überschreiben', async run() {
        const view = await fixture({ save: async () => { throw { status: 409 }; } });
        try {
            await view.edit();
            assert(!text(view.root).includes('Speichern wiederholen'), 'Bei Konflikten darf keine Wiederholungsaktion angeboten werden');
            await view.click('Serverstand laden');
            assert(view.loads === 1 && text(view.root).includes('Ungespeicherte Änderungen'), 'Vor dem Laden müssen lokale Änderungen geschützt sein');
            await view.click('Abbrechen');
            assert(view.loads === 1 && !text(view.root).includes('Verwerfen und laden'), 'Abbrechen darf nichts verwerfen');
            await view.click('Serverstand laden'); await view.click('Verwerfen und laden');
            assert(Number(view.loads) === 2 && text(view.root) === '', 'Bestätigtes Laden entfernt den Fehler ohne Erfolgsmeldung');
        } finally { await view.close(); }
    } },
    { name: 'Sitzungsdaten im lokalen Modus werden nicht als Backend-Speicherung bestätigt', async run() {
        const view = await fixture({ persistence: 'session' });
        try { await view.edit(); assert(text(view.root) === '', 'Lokaler Modus darf keine Backend-Bestätigung vortäuschen'); }
        finally { await view.close(); }
    } },
    { name: 'Beim Verlassen der Sitzung werden laufende Benachrichtigungstimer entfernt', async run(context: TimerTestContext) {
        context.mock.timers.enable({ apis: ['setTimeout'] });
        const view = await fixture();
        await view.edit(); await view.close();
        act(() => context.mock.timers.tick(5000));
        assert(view.store.getSnapshot().saveNotice?.kind === 'success', 'Ein Timer einer entfernten Oberfläche darf den alten Store nicht mehr verändern');
    } }
];

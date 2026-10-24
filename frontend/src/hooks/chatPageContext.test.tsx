import { createElement, useState } from 'react';
import { act, create } from 'react-test-renderer';
import type { ReactTestRenderer } from 'react-test-renderer';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { useChatPageContext, useChatProjectSelection } from './chatPageContext';
import ChatPageContextProvider from '../components/chat/ChatPageContextProvider';
import type { ChatPageContext } from '../services/ai/pageContext';
import type { ProjectTab } from '../pages/projects/types/projectTabs.types';
import PageContextLabel from '../components/chat/PageContextLabel';
import { darkTheme } from '../styles/theme';
import { LanguageContext } from './languageContext';

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
export const chatPageContextTests = [
    { name: 'Chat-Seitenbezug folgt Navigation und sichtbarer Auswahl ohne alte Projekte oder private URL-Parameter', async run() {
        let page: ChatPageContext | null = null;
        let select: (id: number | null, tab?: ProjectTab) => void = () => {};
        let navigate: ReturnType<typeof useNavigate> = () => {};
        function Host() {
            const [projectId, setProject] = useState<number | null>(17);
            const [tab, setTab] = useState<ProjectTab>('tasks');
            const location = useLocation(); navigate = useNavigate();
            const visible = location.pathname === '/projectManager/projects' && !(location.state as { projectOverview?: boolean } | null)?.projectOverview;
            useChatProjectSelection(visible ? projectId : null, tab);
            select = (id, nextTab = 'tasks') => { setProject(id); setTab(nextTab); };
            page = useChatPageContext();
            return createElement(PageContextLabel, { page });
        }
        let renderer!: ReactTestRenderer;
        await act(async () => { renderer = create(createElement(ThemeProvider, { theme: darkTheme },
            createElement(LanguageContext.Provider, { value: 'en' }, createElement(MemoryRouter, { initialEntries: ['/projectManager/projects'] },
                createElement(ChatPageContextProvider, null, createElement(Host)))))); });
        try {
            const current = () => page as ChatPageContext | null;
            assert(current()?.projectId === 17 && current()?.projectTab === 'tasks', 'Sichtbares Projekt und Tab fehlen');
            assert(JSON.stringify(renderer.toJSON()).includes('Project #17'), 'Seitenbezug muss sichtbar und übersetzt sein');
            await act(async () => select(42, 'board'));
            assert(current()?.projectId === 42 && current()?.projectTab === 'board', 'Projekt-/Tabwechsel muss sofort berücksichtigt werden');
            await act(async () => navigate('/wiki/search?query=test-only-private'));
            assert(current()?.route === '/wiki/search' && current()?.projectId == null && !JSON.stringify(current()).includes('test-only-private'), 'Wiki darf weder alten Projektbezug noch Suchtext erhalten');
            await act(async () => navigate('/projectManager/projects', { state: { projectOverview: true } }));
            assert(current()?.projectId == null, 'Zurück zur Übersicht muss Projektbezug entfernen');
            await act(async () => navigate('/projectManager/projects', { state: null }));
            await act(async () => select(null));
            assert(current()?.projectId == null, 'Gelöschte/abgewählte Projekte müssen entfernt werden');
            await act(async () => navigate('/invalid'));
            assert(current() === null, 'Ungültige Routen dürfen keinen Kontext erben');
        } finally { await act(async () => renderer.unmount()); }
    } }
];

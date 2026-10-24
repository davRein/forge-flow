import { act, create } from 'react-test-renderer';
import type { ReactTestRenderer } from 'react-test-renderer';
import { useLocation } from 'react-router-dom';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { useChatNavigation } from './chatNavigationContext';
import { useChatPageContext } from './chatPageContext';
import ChatPageContextProvider from '../components/chat/ChatPageContextProvider';
import ChatNavigationProvider from '../components/chat/ChatNavigationProvider';
import ProjectsPage from '../pages/projects/ProjectsPage';
import { WorkspaceContext } from './workspaceContext';
import { createWorkspaceStore } from '../services/workspace/workspaceStore';
import { createInitialWorkspace } from '../services/workspace/initialWorkspace';
import { defaultSettings } from '../config/appSettings';
import { darkTheme } from '../styles/theme';
import { NavigationError } from '../services/ai/navigationActions';
import type { NavigationAction } from '../services/ai/navigationActions';
import type { ChatPageContext } from '../services/ai/pageContext';

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
export const chatNavigationTests = [
    { name: 'Freigegebene Chatnavigation öffnet reale Projektansichten und schützt offene Formulare und veraltete Ziele', async run() {
        const data = createInitialWorkspace();
        data.projects = [{ ...data.projects[0], id: 17, name: 'Alpha' }]; data.tasks = [];
        const workspace = createWorkspaceStore({ persistence: 'session', async load() { return { data, revision: '1' }; }, async save() { return '2'; } });
        await workspace.load();
        let navigation!: ReturnType<typeof useChatNavigation>;
        let page: ChatPageContext | null = null;
        function Host() {
            const location = useLocation();
            navigation = useChatNavigation(); page = useChatPageContext();
            return <ProjectsPage section={location.pathname === '/projectManager/projects' ? 'projects' : 'dashboard'}
                settings={defaultSettings} onSettingsChange={() => {}} onSettingsReset={() => {}} settingsStatus="ready" settingsError={null} settingsPersistence="session" onSettingsRetry={() => {}} />;
        }
        let renderer!: ReactTestRenderer;
        await act(async () => { renderer = create(<ThemeProvider theme={darkTheme}><MemoryRouter initialEntries={['/wiki/home']}><ChatPageContextProvider><ChatNavigationProvider>
            <WorkspaceContext.Provider value={workspace}><Host /></WorkspaceContext.Provider>
        </ChatNavigationProvider></ChatPageContextProvider></MemoryRouter></ThemeProvider>); });
        const action: NavigationAction = { id: '11111111-1111-4111-8111-111111111111', type: 'project.open', projectId: 17, projectName: 'Alpha', projectTab: 'overview', expiresAt: '2099-01-01T00:00:00Z', status: 'approved', resultCode: null };
        const currentPage = () => page as ChatPageContext | null;
        async function execute(target: NavigationAction) {
            let result!: Promise<void>;
            await act(async () => { result = navigation.execute(target, new AbortController().signal); void result.catch(() => {}); });
            await result;
        }
        try {
            assert(navigation.available && currentPage()?.projectId == null, 'Registrierung darf nicht von sich aus navigieren');
            await execute(action);
            assert(currentPage()?.route === '/projectManager/projects' && currentPage()?.projectId === 17 && currentPage()?.projectTab === 'overview', 'Projektöffnung muss vom tatsächlich sichtbaren Kontext bestätigt werden');
            await execute({ ...action, type: 'project.view', projectTab: 'tasks' });
            assert(currentPage()?.projectTab === 'tasks', 'Aufgabenliste fehlt');
            await execute({ ...action, type: 'project.view', projectTab: 'board' });
            assert(currentPage()?.projectTab === 'board', 'Kanban fehlt');
            let stale = '';
            try { await execute({ ...action, projectName: 'Renamed elsewhere' }); } catch (error) { stale = error instanceof NavigationError ? error.code : ''; }
            assert(stale === 'NAVIGATION_UNAVAILABLE' && currentPage()?.projectTab === 'board', 'Veraltetes Ziel darf keine andere Auswahl öffnen');
            const cancelled = new AbortController(); cancelled.abort();
            let aborted = '';
            await navigation.execute(action, cancelled.signal).catch(error => { aborted = error instanceof NavigationError ? error.code : ''; });
            assert(aborted === 'CLIENT_CANCELLED', 'Veraltete Sitzung darf nicht navigieren');
            const back = renderer.root.findAllByType('button').find(button => button.children.includes('← Zurück zur Übersicht'));
            assert(back, 'Übersichtsbutton fehlt'); await act(async () => back.props.onClick());
            const createProject = renderer.root.findAllByType('button').find(button => button.props['aria-label'] === 'New project');
            assert(createProject, 'Projektformular fehlt'); await act(async () => createProject.props.onClick());
            assert(navigation.blocked, 'Offenes Formular muss Chatnavigation blockieren');
            let failed = '';
            try { await execute(action); } catch (error) { failed = error instanceof NavigationError ? error.code : ''; }
            assert(failed === 'UNSAVED_CHANGES' && renderer.root.findAllByType('form').length > 0, 'Formular muss bei blockiertem Wechsel erhalten bleiben');
        } finally { await act(async () => renderer.unmount()); workspace.dispose(); }
    } }
];

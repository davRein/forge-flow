import { HashRouter, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { useMemo } from 'react';
import GlobalStyle from './styles/global';
import { themes } from './styles/theme';
import MainLayout from './components/layout/MainLayout';
import { modules } from './config/moduleConfig';
import ProjectsPage from './pages/projects/ProjectsPage';
import WikiPage from './pages/wiki/WikiPage';
import DevToolsPage from './pages/devTools/DevToolsPage';
import TimeTrackerPage from './pages/timeTracker/TimeTrackerPage';
import BusinessPage from './pages/business/BusinessPage';
import CloudPage from './pages/cloud/CloudPage';
import PortalApp from './pages/business/PortalApp';
import BusinessProvider from './components/BusinessProvider';
import { createApiBusinessRepository, createSessionBusinessRepository } from './services/business/business';
import TimeTrackingProvider from './components/TimeTrackingProvider';
import { createApiTimeTrackingRepository, createSessionTimeTrackingRepository } from './services/time/timeTracking';
import { Container, Title } from './pages/projects/styles/pageStyles';
import { useAppSettings } from './hooks/useAppSettings';
import type { SettingsRepository } from './services/settings/settingsRepository';
import { sessionSettingsRepository } from './services/settings/sessionSettingsRepository';
import { PrimaryButton } from './pages/projects/styles/projectStyles';
import AuthProvider from './components/AuthProvider';
import WorkspaceProvider from './components/WorkspaceProvider';
import WorkspaceNotifications from './components/WorkspaceNotifications';
import LoginPage from './pages/auth/LoginPage';
import { useAuth } from './hooks/authContext';
import { apiClient, apiEnabled } from './services/api/runtime';
import { createApiSettingsRepository } from './services/settings/apiSettingsRepository';
import { createApiWorkspaceRepository, localWorkspaceRepository } from './services/workspace/workspaceRepository';
import LanguageProvider from './components/LanguageProvider';
import { useTranslation } from './hooks/languageContext';
import { getBrowserLanguage } from './services/i18n/browserLanguage';
import ChatWidget from './components/chat/ChatWidget';
import ChatPageContextProvider from './components/chat/ChatPageContextProvider';
import ChatNavigationProvider from './components/chat/ChatNavigationProvider';
import GlobalSettingsProvider from './components/GlobalSettingsProvider';
import NavigationGuardProvider from './components/navigation/NavigationGuardProvider';
import { useNavigationGuard, useUnsavedChanges } from './hooks/navigationGuard';
import RestCollectionsProvider from './components/RestCollectionsProvider';
import { createApiRestCollectionsRepository, createSessionRestCollectionsRepository } from './services/rest/restCollections';
import { createGlobalSettingsRepository, createSessionGlobalSettingsRepository } from './services/settings/globalSettings';

type SettingsState = ReturnType<typeof useAppSettings>;

function AppContent({ settings, updateSettings, resetSettings, discardUnsaved, status, error, retry, persistence }: SettingsState) {
    const { t } = useTranslation();
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const guard = useNavigationGuard();
    useUnsavedChanges(error?.operation === 'save', discardUnsaved, status === 'saving');
    const [, moduleKey, pageKey] = pathname.split('/');
    const matchedModule = modules.find((module) => module.key === moduleKey);
    const matchedPage = matchedModule?.topbarItems.find((item) => item.key === pageKey);
    const validRoute = !!matchedPage && pathname.split('/').length === 3;
    const currentModule = validRoute && matchedModule ? matchedModule : modules[0];
    const currentPage = validRoute && matchedPage ? matchedPage
        : currentModule.topbarItems.find((item) => item.key === settings.defaultProjectView)!;
    const projectStartPath = `/projectManager/${settings.defaultProjectView}`;

    if (status === 'loading') {
        return <Container role="status"><Title>{t('Einstellungen werden geladen …')}</Title></Container>;
    }
    if (error?.operation === 'load') {
        return (
            <Container>
                <Title>{t('Einstellungen nicht verfügbar')}</Title>
                <p role="alert">{t(error.message)}</p>
                <PrimaryButton style={{ marginTop: 16 }} onClick={retry}>{t('Erneut versuchen')}</PrimaryButton>
            </Container>
        );
    }

    return (
        <MainLayout
            modules={modules}
            activeModule={currentModule.key}
            unsavedSettings={status === 'saving' || error?.operation === 'save'}
            onModuleChange={(key) => {
                const module = modules.find((entry) => entry.key === key)!;
                guard.request(() => navigate(key === 'projectManager' ? projectStartPath : `/${key}/${module.topbarItems[0].key}`,
                    { state: { projectOverview: true } }));
            }}
        >
            <WorkspaceNotifications />
            {!validRoute && <Navigate to={projectStartPath} state={{ projectOverview: true }} replace />}
            <div hidden={currentModule.key !== 'projectManager'}>
                <ProjectsPage
                    active={currentModule.key === 'projectManager'}
                    section={currentModule.key === 'projectManager' ? currentPage.key : settings.defaultProjectView}
                    settings={settings}
                    onSettingsChange={updateSettings}
                    onSettingsReset={resetSettings}
                    settingsStatus={status}
                    settingsError={error}
                    settingsPersistence={persistence}
                    onSettingsRetry={retry}
                />
            </div>
            <div hidden={currentModule.key !== 'wiki'}>
                <WikiPage section={currentModule.key === 'wiki' ? currentPage.key : 'home'} active={currentModule.key === 'wiki'} />
            </div>
            <div hidden={currentModule.key !== 'devTools'}>
                <DevToolsPage section={currentModule.key === 'devTools' ? currentPage.key : 'json'} active={currentModule.key === 'devTools'} />
            </div>
            <div hidden={currentModule.key !== 'timeTracker'}>
                <TimeTrackerPage section={currentModule.key === 'timeTracker' ? currentPage.key : 'calendar'} active={currentModule.key === 'timeTracker'} />
            </div>
            <div hidden={currentModule.key !== 'business'}>
                <BusinessPage section={currentModule.key === 'business' ? currentPage.key : 'budgets'} active={currentModule.key === 'business'} />
            </div>
            <div hidden={currentModule.key !== 'cloud'}><CloudPage /></div>
        </MainLayout>
    );
}

type AppProps = { userId?: string | null; settingsRepository?: SettingsRepository };

function SignedInApp({ userId = null, settingsRepository }: AppProps) {
    const auth = useAuth();
    const ownerId = auth.user?.id ?? userId;
    const repository = useMemo(() => settingsRepository ?? (apiEnabled && ownerId ? createApiSettingsRepository(apiClient, ownerId) : sessionSettingsRepository), [settingsRepository, ownerId]);
    const workspaceRepository = useMemo(() => apiEnabled ? createApiWorkspaceRepository(apiClient) : localWorkspaceRepository, []);
    const settingsState = useAppSettings({ userId: ownerId, repository });
    const globalRepository = useMemo(() => apiEnabled ? createGlobalSettingsRepository(apiClient) : createSessionGlobalSettingsRepository(), []);
    const restRepository = useMemo(() => apiEnabled ? createApiRestCollectionsRepository(apiClient) : createSessionRestCollectionsRepository(), []);
    const timeRepository = useMemo(() => apiEnabled ? createApiTimeTrackingRepository(apiClient) : createSessionTimeTrackingRepository(), []);
    const businessRepository = useMemo(() => apiEnabled ? createApiBusinessRepository(apiClient) : createSessionBusinessRepository(), []);
    return (
        <ThemeProvider theme={themes[settingsState.settings.themeMode]}>
            <GlobalStyle />
            <LanguageProvider language={settingsState.settings.language}>
                <HashRouter><ChatPageContextProvider><ChatNavigationProvider><NavigationGuardProvider>
                    <WorkspaceProvider repository={workspaceRepository}><GlobalSettingsProvider repository={globalRepository}><RestCollectionsProvider repository={restRepository}><TimeTrackingProvider repository={timeRepository}><BusinessProvider repository={businessRepository}><AppContent {...settingsState} />
                        {apiEnabled && <ChatWidget />}
                    </BusinessProvider></TimeTrackingProvider></RestCollectionsProvider></GlobalSettingsProvider></WorkspaceProvider>
                </NavigationGuardProvider></ChatNavigationProvider></ChatPageContextProvider></HashRouter>
            </LanguageProvider>
        </ThemeProvider>
    );
}

function AuthGate(props: AppProps) {
    const auth = useAuth();
    return apiEnabled && auth.status !== 'authenticated'
        ? <LanguageProvider language={getBrowserLanguage()}><LoginPage /></LanguageProvider>
        : auth.user?.portalOnly ? <PortalApp key={`${auth.user.id}:${auth.epoch}`} /> : <SignedInApp key={`${auth.user?.id ?? 'local'}:${auth.epoch}`} {...props} />;
}

export default function App(props: AppProps) {
    return <ThemeProvider theme={themes.dark}><GlobalStyle /><AuthProvider><AuthGate {...props} /></AuthProvider></ThemeProvider>;
}

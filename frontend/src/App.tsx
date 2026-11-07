import { HashRouter, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { useContext, useMemo, useSyncExternalStore } from 'react';
import GlobalStyle from './styles/global';
import { themes } from './styles/theme';
import MainLayout from './components/layout/MainLayout';
import { modules } from './config/moduleConfig';
import ProjectsPage from './pages/projects/ProjectsPage';
import WikiPage from './pages/wiki/WikiPage';
import DevToolsPage from './pages/devTools/DevToolsPage';
import RequestLabPage from './pages/requestLab/RequestLabPage';
import GitPage from './pages/devTools/GitPage';
import DeveloperProvider from './components/DeveloperProvider';
import TimeTrackerPage from './pages/timeTracker/TimeTrackerPage';
import BusinessPage from './pages/business/BusinessPage';
import CloudPage from './pages/cloud/CloudPage';
import ShowcasePage from './pages/showcase/ShowcasePage';
import { showcaseAccess } from './config/showcaseProjects';
import SettingsPage from './pages/projects/components/SettingsPage';
import { Page as SettingsContainer } from './pages/business/businessStyles';
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
import { createGlobalSettingsRepository, createSessionGlobalSettingsRepository, defaultVisibleApps } from './services/settings/globalSettings';
import { GlobalSettingsContext } from './hooks/globalSettingsContext';

type SettingsState = ReturnType<typeof useAppSettings>;

function AppContent({ settings, updateSettings, resetSettings, discardUnsaved, status, error, retry, persistence }: SettingsState) {
    const { t } = useTranslation();
    const auth = useAuth();
    const allowShowcase = showcaseAccess(auth.user?.administrator);
    const globalSettingsStore = useContext(GlobalSettingsContext)!;
    const globalSettings = useSyncExternalStore(globalSettingsStore.subscribe, globalSettingsStore.getSnapshot, globalSettingsStore.getSnapshot);
    const visibleApps = globalSettings.data?.visibleApps ?? defaultVisibleApps;
    const aiApps = globalSettings.data?.aiApps ?? ['projectManager'];
    const canUseApp = (key: string) => key === 'settings' || !auth.user || auth.user.administrator || !!auth.user.allowedApps?.includes(key);
    const availableModules = modules.filter(module => module.key === 'settings'
        || visibleApps.includes(module.key as typeof visibleApps[number])
            && canUseApp(module.key)
            && (allowShowcase || (module.key !== 'knowledgeHub' && module.key !== 'flowPilot' && module.key !== 'pulseWatch' && module.key !== 'dataScout')));
    const { pathname, search } = useLocation();
    const navigate = useNavigate();
    const guard = useNavigationGuard();
    useUnsavedChanges(error?.operation === 'save', discardUnsaved, status === 'saving');
    const canonicalPath = pathname === '/devTools/rest' ? '/requestLab/client' : pathname;
    const [, moduleKey, pageKey] = canonicalPath.split('/');
    const matchedModule = availableModules.find((module) => module.key === moduleKey);
    const matchedPage = matchedModule?.topbarItems.find((item) => item.key === pageKey);
    const validRoute = !!matchedPage && canonicalPath.split('/').length === 3;
    const fallbackModule = availableModules.find(module => module.key === 'projectManager')
        ?? availableModules.find(module => module.key !== 'settings')
        ?? availableModules.find(module => module.key === 'settings')!;
    const currentModule = validRoute && matchedModule ? matchedModule : fallbackModule;
    const currentPage = validRoute && matchedPage ? matchedPage
        : currentModule.topbarItems.find((item) => item.key === settings.defaultProjectView) ?? currentModule.topbarItems[0];
    const fallbackPath = currentModule.key === 'settings' ? '/settings/general'
        : `/${currentModule.key}/${currentModule.key === 'projectManager' ? settings.defaultProjectView : currentPage.key}`;
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
            modules={availableModules}
            activeModule={currentModule.key}
            unsavedSettings={status === 'saving' || error?.operation === 'save'}
            onModuleChange={(key) => {
                const module = modules.find((entry) => entry.key === key)!;
                guard.request(() => navigate(key === 'projectManager' ? projectStartPath : `/${key}/${module.topbarItems[0].key}`,
                    { state: { projectOverview: true } }));
            }}
        >
            <WorkspaceNotifications />
            {(!validRoute || canonicalPath !== pathname) && <Navigate to={validRoute ? `${canonicalPath}${search}` : pathname === '/projectManager/settings' ? `/settings/general${search}` : fallbackPath} state={{ projectOverview: true }} replace />}
            <div hidden={currentModule.key !== 'settings'}>{canUseApp('settings') && <>{currentModule.key === 'settings' && <SettingsContainer><h1>{t('Einstellungen')}</h1><SettingsPage settings={settings} onChange={updateSettings} onReset={resetSettings} status={status} error={error} persistence={persistence} onRetry={retry} /></SettingsContainer>}</>}</div>
            <div hidden={currentModule.key !== 'projectManager'}>{canUseApp('projectManager') && <>
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
            </>}</div>
            <div hidden={currentModule.key !== 'wiki'}>{canUseApp('wiki') && <>
                <WikiPage section={currentModule.key === 'wiki' ? currentPage.key : 'home'} active={currentModule.key === 'wiki'} />
            </>}</div>
            <div hidden={currentModule.key !== 'devTools'}>{canUseApp('devTools') && <>
                <DevToolsPage section={currentModule.key === 'devTools' ? currentPage.key : 'json'} active={currentModule.key === 'devTools'} />
            </>}</div>
            <div hidden={currentModule.key !== 'requestLab'}>{canUseApp('requestLab') && <><RequestLabPage active={currentModule.key === 'requestLab'} /></>}</div>
            <div hidden={currentModule.key !== 'git'}>{canUseApp('git') && <><GitPage active={currentModule.key === 'git'} /></>}</div>
            <div hidden={currentModule.key !== 'timeTracker'}>{canUseApp('timeTracker') && <>
                <TimeTrackerPage section={currentModule.key === 'timeTracker' ? currentPage.key : 'calendar'} active={currentModule.key === 'timeTracker'} />
            </>}</div>
            <div hidden={currentModule.key !== 'business'}>{canUseApp('business') && <>
                <BusinessPage section={currentModule.key === 'business' ? currentPage.key : 'budgets'} active={currentModule.key === 'business'} />
            </>}</div>
            <div hidden={currentModule.key !== 'cloud'}>{canUseApp('cloud') && <><CloudPage /></>}</div>
            {allowShowcase && <div hidden={currentModule.key !== 'knowledgeHub'}>{canUseApp('knowledgeHub') && <><ShowcasePage app="knowledgeHub" active={currentModule.key === 'knowledgeHub'} section={currentModule.key === 'knowledgeHub' ? currentPage.key : 'chat'} /></>}</div>}
            {allowShowcase && <div hidden={currentModule.key !== 'flowPilot'}>{canUseApp('flowPilot') && <><ShowcasePage app="flowPilot" active={currentModule.key === 'flowPilot'} section={currentModule.key === 'flowPilot' ? currentPage.key : 'overview'} /></>}</div>}
            {allowShowcase && <div hidden={currentModule.key !== 'pulseWatch'}>{canUseApp('pulseWatch') && <><ShowcasePage app="pulseWatch" active={currentModule.key === 'pulseWatch'} section="overview" /></>}</div>}
            {allowShowcase && <div hidden={currentModule.key !== 'dataScout'}>{canUseApp('dataScout') && <><ShowcasePage app="dataScout" active={currentModule.key === 'dataScout'} section={currentModule.key === 'dataScout' ? currentPage.key : 'dashboard'} /></>}</div>}
            {apiEnabled && <ChatWidget visible={aiApps.includes(currentModule.key as typeof aiApps[number])} />}
        </MainLayout>
    );
}

type AppProps = { userId?: string | null; settingsRepository?: SettingsRepository };

function SignedInApp({ userId = null, settingsRepository }: AppProps) {
    const auth = useAuth();
    const ownerId = auth.user?.id ?? userId;
    const assigned = (app: string) => !apiEnabled || !!auth.user?.administrator || !!auth.user?.allowedApps?.includes(app);
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
                    <WorkspaceProvider repository={workspaceRepository}><GlobalSettingsProvider repository={globalRepository}><RestCollectionsProvider enabled={assigned('requestLab')} repository={restRepository}><TimeTrackingProvider enabled={assigned('timeTracker')} repository={timeRepository}><BusinessProvider enabled={assigned('business')} repository={businessRepository}><DeveloperProvider><AppContent {...settingsState} />
                    </DeveloperProvider></BusinessProvider></TimeTrackingProvider></RestCollectionsProvider></GlobalSettingsProvider></WorkspaceProvider>
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

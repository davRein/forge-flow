import { useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import ProjectDashboard from './components/ProjectDashboard';
import ProjectList from './components/ProjectList';
import ProjectFrame from './components/ProjectFrame';
import ProjectDetails from './components/ProjectDetails';
import ProjectForm from './components/ProjectForm';
import CustomerModal from './components/CustomerModal';
import CustomerDirectory from './components/CustomerDirectory';
import CustomerDetails from './components/CustomerDetails';
import CustomerDetailDialogs from './components/CustomerDetailDialogs';
import { useCustomerDetails } from './hooks/useCustomerDetails';
import Dialog from './components/Dialog';
import SettingsPage from './components/SettingsPage';
import { useSettingsText } from '../../hooks/languageContext';
import { useChatProjectSelection } from '../../hooks/chatPageContext';
import { useChatNavigationBlocker, useChatNavigator } from '../../hooks/chatNavigationContext';
import { useWorkspacePersistence } from '../../hooks/workspaceContext';
import { NavigationError } from '../../services/ai/navigationActions';
import type { AppSettings } from '../../types/settings.types';
import type { SettingsError, SettingsRepository, SettingsStatus } from '../../services/settings/settingsRepository';
import { ProjectTab } from './types/projectTabs.types';
import { useProjects } from './hooks/useProjects';
import { useTasks } from './tabs/tasks/hooks/useTasks';
import { useEpics } from './tabs/epics/hooks/useEpics';
import { useSprints } from './tabs/sprints/hooks/useSprints';
import { useProjectFiles } from './tabs/files/hooks/useProjectFiles';
import { Container, HeaderRow, Title } from './styles/pageStyles';
import { DangerButton, FormActions, FormCard, PrimaryButton, SecondaryButton } from './styles/projectStyles';

type DeleteTarget = { kind: 'project' | 'customer'; id: number; name: string } | { kind: 'contact'; id: number; name: string; customerId: number };
type Props = {
    section?: string;
    settings: AppSettings;
    onSettingsChange: (settings: AppSettings) => void;
    onSettingsReset: () => void;
    settingsStatus: SettingsStatus;
    settingsError: SettingsError | null;
    settingsPersistence: SettingsRepository['persistence'];
    onSettingsRetry: () => void;
};

export default function ProjectsPage({
    section = 'dashboard', settings, onSettingsChange, onSettingsReset,
    settingsStatus, settingsError, settingsPersistence, onSettingsRetry
}: Props) {
    const t = useSettingsText();
    const state = useProjects();
    const details = useCustomerDetails();
    const [params, setParams] = useSearchParams();
    const customerParam = params.get('customer');
    const selectedCustomer = customerParam && /^[1-9]\d*$/.test(customerParam) ? state.customerList.find(customer => customer.id === Number(customerParam)) : undefined;
    function showCustomer(id: number | null) { const next = new URLSearchParams(params); if (id === null) next.delete('customer'); else next.set('customer', String(id)); setParams(next); }
    const workspace = useWorkspacePersistence();
    const taskState = useTasks(state.selectedProjectId ?? 0, settings.defaultTaskPriority);
    const epicState = useEpics(state.selectedProjectId ?? 0, taskState);
    const sprintState = useSprints(state.selectedProjectId ?? 0, taskState);
    const fileState = useProjectFiles(state.selectedProjectId ?? 0, taskState);
    const navigate = useNavigate();
    const location = useLocation();
    const overviewRequested = (location.state as { projectOverview?: boolean } | null)?.projectOverview === true;
    const [detailSection, setDetailSection] = useState<string | null>(null);
    const [activeProjectTab, setActiveProjectTab] = useState<ProjectTab>('overview');
    const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
    const [query, setQuery] = useState('');
    const isProjectSection = section === 'dashboard' || section === 'projects';
    const showDetails = isProjectSection && detailSection === section && !!state.selectedProject && !overviewRequested;
    useChatProjectSelection(showDetails && location.pathname === `/projectManager/${section}` ? state.selectedProjectId : null, activeProjectTab);
    const navigationBlocked = !!state.projectEditor || !!state.customerEditor || !!details.contactEditor || !!details.notesEditor || taskState.showForm || !!taskState.selectedTask || !!deleteTarget;
    useChatNavigationBlocker(navigationBlocked || workspace.getSnapshot().status !== 'ready');
    useChatNavigator(action => {
        if (navigationBlocked) throw new NavigationError('UNSAVED_CHANGES');
        const snapshot = workspace.getSnapshot();
        if (snapshot.status !== 'ready') throw new NavigationError('UNSAVED_CHANGES');
        const project = snapshot.data?.projects.find(entry => entry.id === action.projectId);
        const name = project?.name;
        const displayedName = name && name.length > 200 ? name.slice(0, /[\uD800-\uDBFF]/.test(name[199]) ? 199 : 200) : name;
        if (!project || displayedName !== action.projectName) throw new NavigationError('NAVIGATION_UNAVAILABLE');
        openProject(action.projectId, 'projects');
        setActiveProjectTab(action.projectTab);
        navigate('/projectManager/projects', { state: null });
    });
    const search = query.trim().toLocaleLowerCase('de');
    const filteredProjects = state.projectList.filter((project) => {
        const customer = state.customerList.find((entry) => entry.id === project.customerId);
        return `${project.name} ${customer?.name ?? ''}`.toLocaleLowerCase('de').includes(search);
    });

    function openProject(projectId: number, targetSection = section) {
        if (targetSection === section && overviewRequested) {
            navigate(location.pathname, { replace: true, state: null });
        }
        state.setSelectedProjectId(projectId);
        state.closeProjectEditor();
        taskState.closeForm();
        taskState.closeTask();
        setActiveProjectTab('overview');
        setDetailSection(targetSection);
    }

    function confirmDelete() {
        if (!deleteTarget) return;
        if (deleteTarget.kind === 'project') {
            state.deleteProject(deleteTarget.id);
            taskState.removeProjectTasks(deleteTarget.id);
            epicState.removeProjectEpics(deleteTarget.id);
            sprintState.removeProjectSprints(deleteTarget.id);
            fileState.removeProjectFiles(deleteTarget.id);
            if (deleteTarget.id === state.selectedProjectId) setDetailSection(null);
        } else if (deleteTarget.kind === 'contact') {
            details.removeContact(deleteTarget.customerId, deleteTarget.id);
        } else {
            state.deleteCustomer(deleteTarget.id);
        }
        setDeleteTarget(null);
    }

    const selectedProject = state.selectedProject;
    const title = section === 'customers' ? selectedCustomer?.name ?? t('Kunden') : section === 'settings' ? t('Einstellungen')
        : showDetails ? selectedProject?.name : section === 'projects' ? t('Projekte') : t('Projekt Dashboard');

    return (
        <Container $compact={isProjectSection && !showDetails}>
            <HeaderRow>
                <Title lang={section === 'settings' ? settings.language : undefined}>{title}</Title>
                {section === 'customers' && !customerParam && <PrimaryButton onClick={() => state.openCustomerEditor()}>+ Kunde anlegen</PrimaryButton>}
                {showDetails && <SecondaryButton onClick={() => { setDetailSection(null); state.closeProjectEditor(); }}>← Zurück zur Übersicht</SecondaryButton>}
            </HeaderRow>

            {state.projectEditor && isProjectSection && (
                <ProjectForm
                    customers={state.customerList}
                    draft={state.projectEditor.draft}
                    isEditing={state.projectEditor.id !== null}
                    error={state.projectError}
                    onChange={state.changeProject}
                    onNewCustomer={() => state.openCustomerEditor(undefined, true)}
                    onSave={() => { if (state.saveProject()) setQuery(''); }}
                    onClose={state.closeProjectEditor}
                />
            )}

            {isProjectSection && !showDetails && (
                <ProjectFrame query={query} onQueryChange={setQuery} onNew={() => state.openProjectEditor()} count={filteredProjects.length} total={state.projectList.length}>
                    {filteredProjects.length === 0 ? (
                        <p style={{ padding: '12px 10px', fontSize: 13 }}>{t(state.projectList.length === 0 ? 'Noch keine Projekte vorhanden. Lege das erste Projekt an.' : 'Keine Projekte für diese Suche gefunden.')}</p>
                    ) : section === 'dashboard' ? (
                        <ProjectDashboard projects={filteredProjects} customers={state.customerList} onOpenProject={(id) => openProject(id)} />
                    ) : (
                        <ProjectList projects={filteredProjects} selectedProjectId={state.selectedProjectId ?? 0} onSelectProject={(id) => openProject(id)} />
                    )}
                </ProjectFrame>
            )}

            {section === 'customers' && !customerParam && (
                <CustomerDirectory
                    customers={state.customerList}
                    projects={state.projectList}
                    onEdit={(customer) => state.openCustomerEditor(customer)}
                    onDelete={(customer) => setDeleteTarget({ kind: 'customer', id: customer.id, name: customer.name })}
                    onOpenProject={(id) => { openProject(id, 'projects'); navigate('/projectManager/projects'); }}
                    onOpenCustomer={id => showCustomer(id)}
                />
            )}
            {section === 'customers' && customerParam && (selectedCustomer ? <CustomerDetails customer={selectedCustomer} projects={state.projectList}
                onBack={() => showCustomer(null)} onEdit={() => state.openCustomerEditor(selectedCustomer)}
                onOpenProject={id => { openProject(id, 'projects'); navigate('/projectManager/projects'); }}
                onAddContact={() => details.openContact(selectedCustomer.id)} onEditContact={contact => details.openContact(selectedCustomer.id, contact)}
                onRemoveContact={contact => setDeleteTarget({ kind: 'contact', id: contact.id, customerId: selectedCustomer.id, name: contact.name })}
                onEditNotes={() => details.openNotes(selectedCustomer.id)} /> : <FormCard><p>{t('Kunde nicht gefunden.')}</p><SecondaryButton onClick={() => showCustomer(null)}>{t('← Zurück zu den Kunden')}</SecondaryButton></FormCard>)}

            {section === 'settings' && <SettingsPage
                settings={settings} onChange={onSettingsChange} onReset={onSettingsReset}
                status={settingsStatus} error={settingsError} persistence={settingsPersistence} onRetry={onSettingsRetry}
            />}

            {showDetails && selectedProject && (
                <ProjectDetails
                    project={selectedProject}
                    customer={state.customer}
                    activeTab={activeProjectTab}
                    onTabChange={setActiveProjectTab}
                    taskState={taskState}
                    epicState={epicState}
                    sprintState={sprintState}
                    fileState={fileState}
                    onEdit={() => state.openProjectEditor(selectedProject)}
                    onDelete={() => setDeleteTarget({ kind: 'project', id: selectedProject.id, name: selectedProject.name })}
                />
            )}

            {state.customerEditor && (
                <CustomerModal
                    draft={state.customerEditor.draft}
                    isEditing={state.customerEditor.id !== null}
                    error={state.customerError}
                    onChange={state.changeCustomer}
                    onSave={state.saveCustomer}
                    onClose={state.closeCustomerEditor}
                />
            )}

            {deleteTarget && (
                <Dialog title={t(deleteTarget.kind === 'project' ? 'Projekt löschen?' : deleteTarget.kind === 'contact' ? 'Ansprechpartner entfernen?' : 'Kunde löschen?')} onClose={() => setDeleteTarget(null)}>
                    <p>{t('„{name}“ wirklich löschen?', { name: deleteTarget.name })}</p>
                    {deleteTarget.kind === 'project' && <p>Alle zugehörigen Aufgaben, Epics, Sprints, Dateien und Aktivitäten werden ebenfalls entfernt.</p>}
                    {deleteTarget.kind === 'customer' && <p>{t('Zugehörige Ansprechpartner und Notizen werden ebenfalls entfernt.')}</p>}
                    <FormActions>
                        <SecondaryButton autoFocus onClick={() => setDeleteTarget(null)}>{t('Abbrechen')}</SecondaryButton>
                        <DangerButton onClick={confirmDelete}>{t('Endgültig löschen')}</DangerButton>
                    </FormActions>
                </Dialog>
            )}
            <CustomerDetailDialogs state={details} />
        </Container>
    );
}

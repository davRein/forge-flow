import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ProjectDashboard from './components/ProjectDashboard';
import ProjectList from './components/ProjectList';
import ProjectDetails from './components/ProjectDetails';
import ProjectForm from './components/ProjectForm';
import CustomerModal from './components/CustomerModal';
import CustomerDirectory from './components/CustomerDirectory';
import Dialog from './components/Dialog';
import GeneralSettings from './components/GeneralSettings';
import type { AppSettings } from '../../types/settings.types';
import type { SettingsError, SettingsRepository, SettingsStatus } from '../../services/settings/settingsRepository';
import { ProjectTab } from './types/projectTabs.types';
import { useProjects } from './hooks/useProjects';
import { useTasks } from './tabs/tasks/hooks/useTasks';
import { useEpics } from './tabs/epics/hooks/useEpics';
import { useSprints } from './tabs/sprints/hooks/useSprints';
import { useProjectFiles } from './tabs/files/hooks/useProjectFiles';
import { Container, HeaderRow, Title } from './styles/pageStyles';
import { DangerButton, Field, FormActions, FormCard, Input, PrimaryButton, SecondaryButton } from './styles/projectStyles';

type DeleteTarget = { kind: 'project' | 'customer'; id: number; name: string };
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
    const state = useProjects();
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
        } else {
            state.deleteCustomer(deleteTarget.id);
        }
        setDeleteTarget(null);
    }

    const selectedProject = state.selectedProject;
    const title = section === 'customers' ? 'Kunden' : section === 'settings' ? 'Einstellungen'
        : showDetails ? selectedProject?.name : section === 'projects' ? 'Projekte' : 'Projekt Dashboard';

    return (
        <Container>
            <HeaderRow>
                <Title>{title}</Title>
                {isProjectSection && !showDetails && <PrimaryButton onClick={() => state.openProjectEditor()}>+ Projekt anlegen</PrimaryButton>}
                {section === 'customers' && <PrimaryButton onClick={() => state.openCustomerEditor()}>+ Kunde anlegen</PrimaryButton>}
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
                <>
                    <Field>
                        Projekte suchen
                        <Input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Projektname oder Kunde" />
                    </Field>
                    <p aria-live="polite">{filteredProjects.length} von {state.projectList.length} Projekten</p>
                    {filteredProjects.length === 0 ? (
                        <FormCard>{state.projectList.length === 0 ? 'Noch keine Projekte vorhanden. Lege das erste Projekt an.' : 'Keine Projekte für diese Suche gefunden.'}</FormCard>
                    ) : section === 'dashboard' ? (
                        <ProjectDashboard projects={filteredProjects} customers={state.customerList} onOpenProject={(id) => openProject(id)} />
                    ) : (
                        <ProjectList projects={filteredProjects} selectedProjectId={state.selectedProjectId ?? 0} onSelectProject={(id) => openProject(id)} />
                    )}
                </>
            )}

            {section === 'customers' && (
                <CustomerDirectory
                    customers={state.customerList}
                    projects={state.projectList}
                    onEdit={(customer) => state.openCustomerEditor(customer)}
                    onDelete={(customer) => setDeleteTarget({ kind: 'customer', id: customer.id, name: customer.name })}
                    onOpenProject={(id) => { openProject(id, 'projects'); navigate('/projectManager/projects'); }}
                />
            )}

            {section === 'settings' && <GeneralSettings
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
                <Dialog title={deleteTarget.kind === 'project' ? 'Projekt löschen?' : 'Kunde löschen?'} onClose={() => setDeleteTarget(null)}>
                    <p>„{deleteTarget.name}“ wirklich löschen?</p>
                    {deleteTarget.kind === 'project' && <p>Alle zugehörigen Aufgaben, Epics, Sprints, Dateien und Aktivitäten werden ebenfalls entfernt.</p>}
                    <FormActions>
                        <SecondaryButton autoFocus onClick={() => setDeleteTarget(null)}>Abbrechen</SecondaryButton>
                        <DangerButton onClick={confirmDelete}>Endgültig löschen</DangerButton>
                    </FormActions>
                </Dialog>
            )}
        </Container>
    );
}

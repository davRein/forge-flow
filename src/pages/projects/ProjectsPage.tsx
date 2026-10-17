import { useState } from 'react';

import ProjectDashboard from './components/ProjectDashboard';
import ProjectDetails from './components/ProjectDetails';
import ProjectForm from './components/ProjectForm';
import CustomerModal from './components/CustomerModal';
import { ProjectTab } from './types/projectTabs.types';
import { useProjects } from './hooks/useProjects';

import {
    Container,
    HeaderRow,
    IconButton,
    Title
} from './styles/pageStyles';

type ViewMode = 'dashboard' | 'project';

export default function ProjectsPage() {
    const projectsState = useProjects();

    const [viewMode, setViewMode] = useState<ViewMode>('dashboard');

    const [activeProjectTab, setActiveProjectTab] =
        useState<ProjectTab>('overview');

    function openProject(projectId: number) {
        projectsState.setSelectedProjectId(projectId);
        setActiveProjectTab('overview');
        setViewMode('project');
    }

    return (
        <Container>
            <HeaderRow>
                <Title>
                    {viewMode === 'dashboard'
                        ? 'Projekt Dashboard'
                        : projectsState.selectedProject?.name}
                </Title>

                {viewMode === 'dashboard' && (
                    <IconButton
                        title="Projekt anlegen"
                        onClick={() =>
                            projectsState.setShowCreateForm(true)
                        }
                    >
                        📁+
                    </IconButton>
                )}

                {viewMode === 'project' && (
                    <IconButton
                        title="Zurück zum Dashboard"
                        onClick={() => setViewMode('dashboard')}
                    >
                        ←
                    </IconButton>
                )}
            </HeaderRow>

            {projectsState.showCreateForm && (
                <ProjectForm
                    customers={projectsState.customerList}
                    projectName={projectsState.newProjectName}
                    setProjectName={projectsState.setNewProjectName}
                    customerId={projectsState.newCustomerId}
                    onCustomerChange={projectsState.handleCustomerChange}
                    deadline={projectsState.newDeadline}
                    setDeadline={projectsState.setNewDeadline}
                    planningCompleted={projectsState.newPlanningCompleted}
                    setPlanningCompleted={
                        projectsState.setNewPlanningCompleted
                    }
                    onSave={projectsState.handleCreateProject}
                    onClose={projectsState.closeProjectForm}
                />
            )}

            {viewMode === 'dashboard' && (
                <ProjectDashboard
                    projects={projectsState.projectList}
                    customers={projectsState.customerList}
                    onOpenProject={openProject}
                />
            )}

            {viewMode === 'project' && (
                <ProjectDetails
                    project={projectsState.selectedProject}
                    customer={projectsState.customer}
                    activeTab={activeProjectTab}
                    onTabChange={setActiveProjectTab}
                />
            )}

            {projectsState.showCustomerModal && (
                <CustomerModal
                    name={projectsState.newCustomerName}
                    setName={projectsState.setNewCustomerName}
                    street={projectsState.newCustomerStreet}
                    setStreet={projectsState.setNewCustomerStreet}
                    city={projectsState.newCustomerCity}
                    setCity={projectsState.setNewCustomerCity}
                    country={projectsState.newCustomerCountry}
                    setCountry={projectsState.setNewCustomerCountry}
                    email={projectsState.newCustomerEmail}
                    setEmail={projectsState.setNewCustomerEmail}
                    website={projectsState.newCustomerWebsite}
                    setWebsite={projectsState.setNewCustomerWebsite}
                    phone={projectsState.newCustomerPhone}
                    setPhone={projectsState.setNewCustomerPhone}
                    industry={projectsState.newCustomerIndustry}
                    setIndustry={projectsState.setNewCustomerIndustry}
                    onSave={projectsState.handleCreateCustomer}
                    onClose={projectsState.closeCustomerModal}
                />
            )}
        </Container>
    );
}
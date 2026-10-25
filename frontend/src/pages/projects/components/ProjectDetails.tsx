import styled from 'styled-components';

import StatusBadge from './StatusBadge';
import ProjectTabs from './ProjectTabs';
import ProjectTabContent from './ProjectTabContent';

import { Customer, Project } from '../types/project.types';
import { ProjectTab } from '../types/projectTabs.types';

import { getProjectStatus } from '../../../utils/getProjectStatus';
import { useTasks } from '../tabs/tasks/hooks/useTasks';
import type { useEpics } from '../tabs/epics/hooks/useEpics';
import type { useSprints } from '../tabs/sprints/hooks/useSprints';
import type { useProjectFiles } from '../tabs/files/hooks/useProjectFiles';
import { surface } from '../../../styles/primitives';
import { ProjectBudgetSummary } from '../../business/ProjectBudgets';

const Container = styled.div`
    ${surface}
    min-width: 0;
    padding: 24px;
    @media (max-width: 760px) { padding: 16px; }
`;

const Meta = styled.p`
    color: ${({ theme }) => theme.colors.textSecondary};

    margin-top: 8px;
`;

const Content = styled.div`
    margin-top: 20px;
`;

type Props = {
    project: Project | undefined;
    customer: Customer | undefined;
    activeTab: ProjectTab;
    onTabChange: (tab: ProjectTab) => void;
    taskState: ReturnType<typeof useTasks>;
    epicState: ReturnType<typeof useEpics>;
    sprintState: ReturnType<typeof useSprints>;
    fileState: ReturnType<typeof useProjectFiles>;
    onEdit: () => void;
    onDelete: () => void;
};

export default function ProjectDetails({
                                           project,
                                           customer,
                                           activeTab,
                                           onTabChange,
                                           taskState,
                                           epicState,
                                           sprintState,
                                           fileState,
                                           onEdit,
                                           onDelete
                                       }: Props) {
    if (!project) {
        return (
            <Container>
                Kein Projekt ausgewählt.
            </Container>
        );
    }

    return <SelectedProjectDetails project={project} customer={customer} activeTab={activeTab} onTabChange={onTabChange} taskState={taskState} epicState={epicState} sprintState={sprintState} fileState={fileState} onEdit={onEdit} onDelete={onDelete} />;
}

function SelectedProjectDetails({ project, customer, activeTab, onTabChange, taskState, epicState, sprintState, fileState, onEdit, onDelete }: Props & { project: Project }) {
    const status = getProjectStatus(project);

    return (
        <Container>
            <h2>{project.name}</h2>

            <Meta>Kunde: {customer?.name}</Meta>
            <Meta>Deadline: {project.deadline}</Meta>
            <ProjectBudgetSummary projectId={project.id} />

            <div style={{ marginTop: '12px' }}>
                <StatusBadge
                    label={status.label}
                    color={status.color}
                    pulse={status.pulse}
                />
            </div>

            <ProjectTabs
                activeTab={activeTab}
                onTabChange={onTabChange}
            />

            <Content>
                <ProjectTabContent
                    activeTab={activeTab}
                    onTabChange={onTabChange}
                    project={project}
                    customer={customer}
                    taskState={taskState}
                    epicState={epicState}
                    sprintState={sprintState}
                    fileState={fileState}
                    onEdit={onEdit}
                    onDelete={onDelete}
                />
            </Content>
        </Container>
    );
}

import styled from 'styled-components';

import StatusBadge from './StatusBadge';
import ProjectTabs from './ProjectTabs';
import ProjectTabContent from './ProjectTabContent';

import { Customer, Project } from '../types/project.types';
import { ProjectTab } from '../types/projectTabs.types';

import { getProjectStatus } from '../../../utils/getProjectStatus';
import { useTasks } from '../tabs/tasks/hooks/useTasks';

const Container = styled.div`
    background: ${({ theme }) => theme.colors.header};

    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: 12px;

    padding: 20px;
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
};

export default function ProjectDetails({
                                           project,
                                           customer,
                                           activeTab,
                                           onTabChange
                                       }: Props) {
    if (!project) {
        return (
            <Container>
                Kein Projekt ausgewählt.
            </Container>
        );
    }

    const status = getProjectStatus(project);
    const taskState = useTasks(project.id);

    return (
        <Container>
            <h2>{project.name}</h2>

            <Meta>Kunde: {customer?.name}</Meta>
            <Meta>Deadline: {project.deadline}</Meta>

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
                    project={project}
                    customer={customer}
                    taskState={taskState}
                />
            </Content>
        </Container>
    );
}
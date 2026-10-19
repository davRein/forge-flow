import styled from 'styled-components';

import { Customer, Project } from '../types/project.types';
import { getProjectStatus } from '../../../utils/getProjectStatus';
import StatusBadge from './StatusBadge';

const Container = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
`;

const Card = styled.div`
    background: ${({ theme }) => theme.colors.header};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: 12px;
    padding: 18px;
`;

const CardHeader = styled.div`
    display: flex;
    justify-content: space-between;
    gap: 12px;
`;

const ProjectName = styled.h3`
    margin: 0;
`;

const Meta = styled.p`
    color: ${({ theme }) => theme.colors.textSecondary};
    margin-top: 8px;
`;

const GoToButton = styled.button`
    margin-top: 18px;

    border: none;
    border-radius: 10px;
    padding: 9px 12px;

    cursor: pointer;

    color: ${({ theme }) => theme.colors.onPrimary};
    background: ${({ theme }) => theme.colors.primary};

    font-size: 16px;
    font-weight: 700;

    box-shadow: 0 0 12px ${({ theme }) => theme.colors.primary};
`;

type Props = {
    projects: Project[];
    customers: Customer[];
    onOpenProject: (projectId: number) => void;
};

export default function ProjectDashboard({
                                             projects,
                                             customers,
                                             onOpenProject
                                         }: Props) {
    return (
        <Container>
            {projects.map((project) => {
                const customer = customers.find(
                    (customer) => customer.id === project.customerId
                );

                const status = getProjectStatus(project);

                return (
                    <Card key={project.id}>
                        <CardHeader>
                            <ProjectName>{project.name}</ProjectName>

                            <StatusBadge
                                label={status.label}
                                color={status.color}
                                pulse={status.pulse}
                            />
                        </CardHeader>

                        <Meta>Kunde: {customer?.name}</Meta>
                        <Meta>Deadline: {project.deadline}</Meta>

                        <GoToButton
                            title="Projekt öffnen"
                            onClick={() => onOpenProject(project.id)}
                        >
                            🚶+
                        </GoToButton>
                    </Card>
                );
            })}
        </Container>
    );
}

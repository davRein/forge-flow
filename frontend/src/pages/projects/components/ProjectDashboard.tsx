import styled from 'styled-components';

import { Customer, Project } from '../types/project.types';
import { getProjectStatus } from '../../../utils/getProjectStatus';
import StatusBadge from './StatusBadge';
import { secondaryButton, surface } from '../../../styles/primitives';
import { useTranslation } from '../../../hooks/languageContext';

const Container = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
    gap: 12px;
`;

const Card = styled.div`
    ${surface}
    padding: 16px;
    min-width: 0;
    box-shadow: none;
    &:hover, &:focus-within { border-color: ${({ theme }) => theme.colors.borderStrong}; }
`;

const CardHeader = styled.div`
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
    flex-wrap: wrap;
`;

const ProjectName = styled.h3`
    margin: 0;
`;

const Meta = styled.p`
    color: ${({ theme }) => theme.colors.textSecondary};
    margin-top: 8px;
    font-size: 13px;
`;

const GoToButton = styled.button`
    ${secondaryButton}
    min-height: 30px;
    padding: 5px 9px;
    font-size: 12px;
    margin-top: 14px;
    color: ${({ theme }) => theme.colors.primary};
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
    const { t } = useTranslation();
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

                        <Meta>{t('Kunde')}: {customer?.name}</Meta>
                        <Meta>Deadline: {project.deadline}</Meta>

                        <GoToButton
                            title={t('Projekt öffnen')}
                            onClick={() => onOpenProject(project.id)}
                        >
                            {t('Projekt öffnen')} <span aria-hidden="true">→</span>
                        </GoToButton>
                    </Card>
                );
            })}
        </Container>
    );
}

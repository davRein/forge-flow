import styled from 'styled-components';
import { getBadgeTextColor } from '../../../styles/colorUtils';

import { taskStatuses } from '../../../data/taskStatuses';

import { getProjectStatus } from '../../../utils/getProjectStatus';

import { Customer, Project } from '../types/project.types';
import { Activity } from '../types/activity.types';

import { Task } from '../types/task.types';

const Container = styled.div`
    display: flex;
    flex-direction: column;
    gap: 20px;
`;

const ProjectCard = styled.div`
    background: ${({ theme }) => theme.colors.content};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: 14px;
    padding: 20px;
`;

const ProjectTitle = styled.h2`
    margin-top: 0;
    margin-bottom: 16px;
`;

const MetaGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 160px), 1fr));
    gap: 16px;
`;

const MetaItem = styled.div`
    display: flex;
    flex-direction: column;
    gap: 6px;
`;

const MetaLabel = styled.span`
    color: ${({ theme }) => theme.colors.textSecondary};
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
`;

const MetaValue = styled.span`
    font-size: 15px;
    font-weight: 600;
`;

const StatusBadge = styled.span<{ $color: string }>`
    width: fit-content;
    padding: 6px 10px;
    border-radius: 999px;

    font-size: 12px;
    font-weight: 700;

    color: ${({ $color, theme }) => getBadgeTextColor($color, theme.mode)};
    background: ${({ $color }) => `${$color}20`};

    border: 1px solid ${({ $color }) => `${$color}55`};
`;

const StatsGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 140px), 1fr));
    gap: 16px;
`;

const StatCard = styled.div`
    background: ${({ theme }) => theme.colors.content};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: 14px;
    padding: 18px;
`;

const StatLabel = styled.div`
    color: ${({ theme }) => theme.colors.textSecondary};
    font-size: 13px;
`;

const StatValue = styled.div`
    margin-top: 10px;
    font-size: 28px;
    font-weight: 650;
    font-variant-numeric: tabular-nums;
`;

const Section = styled.div`
    background: ${({ theme }) => theme.colors.content};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: 14px;
    padding: 18px;
`;

const SectionTitle = styled.h3`
    margin-top: 0;
`;

const ProgressWrapper = styled.div`
    width: 100%;
    height: 6px;

    overflow: hidden;
    border-radius: 999px;

    background: ${({ theme }) => theme.colors.header};
`;

const ProgressBar = styled.div<{ $progress: number }>`
    width: ${({ $progress }) => $progress}%;
    height: 100%;

    background: ${({ theme }) => theme.colors.primary};

    transition: width 0.2s ease;
`;

const TaskList = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
`;

const TaskRow = styled.div`
    display: grid;
    grid-template-columns: 90px 1fr 120px;
    gap: 12px;
    align-items: center;

    padding: 12px;

    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: 10px;

    background: ${({ theme }) => theme.colors.header};
`;

const Code = styled.span`
    color: ${({ theme }) => theme.colors.primary};

    font-size: 12px;
    font-weight: 800;
`;

const Badge = styled.span<{ $color: string }>`
    width: fit-content;

    padding: 5px 9px;
    border-radius: 999px;

    font-size: 12px;
    font-weight: 700;

    color: ${({ $color, theme }) => getBadgeTextColor($color, theme.mode)};
    background: ${({ $color }) => `${$color}20`};

    border: 1px solid ${({ $color }) => `${$color}55`};
`;

const EmptyText = styled.p`
    color: ${({ theme }) => theme.colors.textSecondary};
`;

const ActivityList = styled.div`
    display: flex;
    flex-direction: column;
    gap: 10px;
`;

const ActivityItem = styled.div`
    display: flex;
    align-items: center;
    gap: 10px;

    padding: 10px 12px;

    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: 10px;

    background: ${({ theme }) => theme.colors.header};
`;

const ActivityDot = styled.div`
    width: 8px;
    height: 8px;

    border-radius: 999px;

    background: ${({ theme }) => theme.colors.primary};
`;

const ActivityText = styled.div`
    color: ${({ theme }) => theme.colors.textSecondary};
    font-size: 14px;
`;

const DashboardGrid = styled.div`
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 20px;

    @media (max-width: 1200px) {
        grid-template-columns: 1fr;
    }
`;

type Props = {
    project: Project;
    customer: Customer | undefined;
    tasks: Task[];
    activities: Activity[];
};

export default function OverviewTab({
                                        project,
                                        customer,
                                        tasks,
                                        activities
                                    }: Props) {

    const projectStatus =
        getProjectStatus(project);

    const totalTasks =
        tasks.length;

    const completedTasks =
        tasks.filter(
            (task) => task.status === 'done'
        ).length;

    const activeTasks =
        tasks.filter(
            (task) => task.status === 'inProgress'
        ).length;

    const progress =
        totalTasks > 0
            ? Math.round(
                (completedTasks / totalTasks) * 100
            )
            : 0;

    const recentTasks =
        [...tasks]
            .reverse()
            .slice(0, 5);

    const projectActivities =
        activities.slice(0, 5);

    return (
        <Container>

            <ProjectCard>

                <ProjectTitle>
                    {project.name}
                </ProjectTitle>

                <MetaGrid>

                    <MetaItem>
                        <MetaLabel>
                            Kunde
                        </MetaLabel>

                        <MetaValue>
                            {customer?.name ?? '—'}
                        </MetaValue>
                    </MetaItem>

                    <MetaItem>
                        <MetaLabel>
                            Deadline
                        </MetaLabel>

                        <MetaValue>
                            {project.deadline}
                        </MetaValue>
                    </MetaItem>

                    <MetaItem>
                        <MetaLabel>
                            Status
                        </MetaLabel>

                        <StatusBadge
                            $color={projectStatus.color}
                        >
                            {projectStatus.label}
                        </StatusBadge>
                    </MetaItem>

                </MetaGrid>

            </ProjectCard>

            <DashboardGrid>

                <div>

                    <StatsGrid>

                        <StatCard>
                            <StatLabel>Gesamt Tasks</StatLabel>
                            <StatValue>{totalTasks}</StatValue>
                        </StatCard>

                        <StatCard>
                            <StatLabel>Erledigt</StatLabel>
                            <StatValue>{completedTasks}</StatValue>
                        </StatCard>

                        <StatCard>
                            <StatLabel>In Bearbeitung</StatLabel>
                            <StatValue>{activeTasks}</StatValue>
                        </StatCard>

                        <StatCard>
                            <StatLabel>Fortschritt</StatLabel>
                            <StatValue>{progress}%</StatValue>
                        </StatCard>

                    </StatsGrid>

                    <Section style={{ marginTop: 20 }}>

                        <SectionTitle>
                            Projektfortschritt
                        </SectionTitle>

                        <ProgressWrapper>
                            <ProgressBar $progress={progress} />
                        </ProgressWrapper>

                    </Section>

                </div>

                <Section>

                    <SectionTitle>
                        Aktivität
                    </SectionTitle>

                    {projectActivities.length === 0 ? (
                        <EmptyText>
                            Noch keine Aktivität vorhanden.
                        </EmptyText>
                    ) : (
                        <ActivityList>

                            {projectActivities.map((activity) => (
                                <ActivityItem key={activity.id}>
                                    <ActivityDot />

                                    <ActivityText>
                                        {activity.message}
                                    </ActivityText>

                                </ActivityItem>
                            ))}

                        </ActivityList>
                    )}

                </Section>

            </DashboardGrid>

            <Section>

                <SectionTitle>
                    Letzte Tasks
                </SectionTitle>

                {recentTasks.length === 0 ? (

                    <EmptyText>
                        Noch keine Tasks vorhanden.
                    </EmptyText>

                ) : (

                    <TaskList>

                        {recentTasks.map((task) => {

                            const status =
                                taskStatuses[task.status];

                            return (
                                <TaskRow key={task.id}>

                                    <Code>
                                        {task.code}
                                    </Code>

                                    <strong>
                                        {task.title}
                                    </strong>

                                    <Badge
                                        $color={status.color}
                                    >
                                        {status.label}
                                    </Badge>

                                </TaskRow>
                            );
                        })}

                    </TaskList>

                )}

            </Section>

        </Container>
    );
}

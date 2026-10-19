import { useState } from 'react';
import styled from 'styled-components';
import { getBadgeTextColor } from '../../../../../styles/colorUtils';

import { taskPriorities } from '../../../../../data/taskPriorities';
import { taskStatuses } from '../../../../../data/taskStatuses';

import { Task, TaskPriorityKey, TaskStatusKey } from '../../../types/task.types';
import type { Sprint } from '../../../types/sprint.types';

type SortMode = 'updated' | 'priority' | 'status';
type StatusFilter = 'all' | TaskStatusKey;
type PriorityFilter = 'all' | TaskPriorityKey;

const Toolbar = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;

    margin-bottom: 12px;
`;

const Filters = styled.div`
    display: flex;
    align-items: center;
    gap: 10px;
`;

const Input = styled.input`
    width: 260px;

    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: 8px;
    padding: 8px;

    background: ${({ theme }) => theme.colors.content};
    color: ${({ theme }) => theme.colors.text};
`;

const Select = styled.select`
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: 8px;
    padding: 8px;

    background: ${({ theme }) => theme.colors.content};
    color: ${({ theme }) => theme.colors.text};
`;

const Table = styled.div`
    width: 100%;
    overflow: hidden;

    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: 12px;

    background: ${({ theme }) => theme.colors.content};
`;

const Header = styled.div`
    display: grid;
    grid-template-columns: 1fr 130px 120px 120px 90px;
    gap: 12px;

    padding: 12px 14px;

    color: ${({ theme }) => theme.colors.textSecondary};
    font-size: 12px;
    font-weight: 700;

    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const Row = styled.div`
    display: grid;
    grid-template-columns: 1fr 130px 120px 120px 90px;
    gap: 12px;
    align-items: center;

    padding: 14px;

    border-bottom: 1px solid ${({ theme }) => theme.colors.border};

    &:last-child {
        border-bottom: none;
    }

    &:hover {
        background: ${({ theme }) => `${theme.colors.primary}12`};
    }
`;

const TitleCell = styled.div`
    display: flex;
    flex-direction: column;
    gap: 4px;
`;

const TaskTitle = styled.strong`
    line-height: 1.3;
`;

const Description = styled.span`
    color: ${({ theme }) => theme.colors.textSecondary};
    font-size: 13px;

    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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

const Actions = styled.div`
    display: flex;
    gap: 8px;
`;

const EditButton = styled.button`
    border: none;
    background: transparent;
    color: ${({ theme }) => theme.colors.primary};
    cursor: pointer;
    font-size: 16px;
`;

const Code = styled.span`
    color: ${({ theme }) => theme.colors.primary};

    font-size: 12px;
    font-weight: 800;

    letter-spacing: 0.5px;
`;

const DeleteButton = styled.button`
    border: none;
    background: transparent;
    color: ${({ theme }) => theme.colors.danger};
    cursor: pointer;
    font-size: 18px;
`;

const EmptyText = styled.p`
    color: ${({ theme }) => theme.colors.textSecondary};
`;

type Props = {
    tasks: Task[];
    epics: { id: number; title: string }[];
    sprints: Sprint[];
    onDeleteTask: (taskId: number) => void;
    onEditTask: (task: Task) => void;
};

export default function TaskList({
                                     tasks,
                                     epics,
                                     sprints,
                                     onDeleteTask,
                                     onEditTask
                                 }: Props) {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
    const [sortMode, setSortMode] = useState<SortMode>('updated');

    const priorityWeight = {
        high: 3,
        medium: 2,
        low: 1
    };

    const statusWeight = {
        todo: 1,
        inProgress: 2,
        done: 3
    };

    const filteredTasks = tasks.filter((task) => {
        const normalizedSearch = searchTerm.trim().toLowerCase();

        const matchesSearch =
            !normalizedSearch ||
            task.title.toLowerCase().includes(normalizedSearch) ||
            task.description?.toLowerCase().includes(normalizedSearch);

        const matchesStatus =
            statusFilter === 'all' || task.status === statusFilter;

        const matchesPriority =
            priorityFilter === 'all' || task.priority === priorityFilter;

        return matchesSearch && matchesStatus && matchesPriority;
    });

    const sortedTasks = [...filteredTasks].sort((a, b) => {
        if (sortMode === 'priority') {
            return priorityWeight[b.priority] - priorityWeight[a.priority];
        }

        if (sortMode === 'status') {
            return statusWeight[a.status] - statusWeight[b.status];
        }

        return b.updatedAt.localeCompare(a.updatedAt);
    });

    if (tasks.length === 0) {
        return (
            <EmptyText>
                Für dieses Projekt gibt es noch keine Tasks.
            </EmptyText>
        );
    }

    return (
        <>
            <Toolbar>
                <Input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Tasks suchen..."
                />

                <Filters>
                    <Select
                        value={statusFilter}
                        onChange={(event) =>
                            setStatusFilter(event.target.value as StatusFilter)
                        }
                    >
                        <option value="all">Alle Status</option>

                        {Object.values(taskStatuses).map((status) => (
                            <option key={status.key} value={status.key}>
                                {status.label}
                            </option>
                        ))}
                    </Select>

                    <Select
                        value={priorityFilter}
                        onChange={(event) =>
                            setPriorityFilter(event.target.value as PriorityFilter)
                        }
                    >
                        <option value="all">Alle Prioritäten</option>

                        {Object.values(taskPriorities).map((priority) => (
                            <option key={priority.key} value={priority.key}>
                                {priority.label}
                            </option>
                        ))}
                    </Select>

                    <Select
                        value={sortMode}
                        onChange={(event) =>
                            setSortMode(event.target.value as SortMode)
                        }
                    >
                        <option value="updated">Aktualisiert</option>
                        <option value="priority">Priorität</option>
                        <option value="status">Status</option>
                    </Select>
                </Filters>
            </Toolbar>

            {sortedTasks.length === 0 ? (
                <EmptyText>
                    Keine Tasks passen zu den aktuellen Filtern.
                </EmptyText>
            ) : (
                <Table>
                    <Header>
                        <span>Task</span>
                        <span>Status</span>
                        <span>Priorität</span>
                        <span>Aktualisiert</span>
                        <span>Aktionen</span>
                    </Header>

                    {sortedTasks.map((task) => {
                        const taskStatus = taskStatuses[task.status];
                        const taskPriority = taskPriorities[task.priority];

                        return (
                            <Row key={task.id}>
                                <TitleCell>

                                    <Code>
                                        {task.code}
                                    </Code>

                                    <TaskTitle>
                                        {task.title}
                                    </TaskTitle>

                                    <Description>Epic: {epics.find((epic) => epic.id === task.epicId)?.title ?? 'Kein Epic'}</Description>
                                    <Description>Sprint: {sprints.find((sprint) => sprint.status !== 'completed' && sprint.taskIds.includes(task.id))?.title ?? 'Kein Sprint'}</Description>

                                    {task.description && (
                                        <Description>
                                            {task.description}
                                        </Description>
                                    )}

                                </TitleCell>

                                <Badge $color={taskStatus.color}>
                                    {taskStatus.label}
                                </Badge>

                                <Badge $color={taskPriority.color}>
                                    {taskPriority.label}
                                </Badge>

                                <span>{task.updatedAt}</span>

                                <Actions>
                                    <EditButton onClick={() => onEditTask(task)}>
                                        ✎
                                    </EditButton>

                                    <DeleteButton
                                        onClick={() => onDeleteTask(task.id)}
                                    >
                                        ×
                                    </DeleteButton>
                                </Actions>
                            </Row>
                        );
                    })}
                </Table>
            )}
        </>
    );
}

import { useState } from 'react';
import styled from 'styled-components';
import { DndContext, DragEndEvent } from '@dnd-kit/core';

import { taskPriorities } from '../../../../../data/taskPriorities';
import { taskStatuses } from '../../../../../data/taskStatuses';

import TaskColumn from './TaskColumn';

import {
    Task,
    TaskPriorityKey,
    TaskStatusKey
} from '../../../types/task.types';

type PriorityFilter = 'all' | TaskPriorityKey;

const Toolbar = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;

    margin-bottom: 12px;
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

const BoardWrapper = styled.div`
    width: 100%;
    overflow-x: auto;
    padding-bottom: 8px;
`;

const Board = styled.div`
    display: grid;
    grid-template-columns: repeat(3, minmax(280px, 1fr));
    gap: 16px;

    min-width: 900px;
`;

type Props = {
    tasks: Task[];
    onDeleteTask: (taskId: number) => void;
    onEditTask: (task: Task) => void;
    onOpenTask: (taskId: number) => void;
    onUpdateTaskStatus: (
        taskId: number,
        status: TaskStatusKey
    ) => void;
};

export default function TaskBoard({
                                      tasks,
                                      onDeleteTask,
                                      onEditTask,
                                      onOpenTask,
                                      onUpdateTaskStatus
                                  }: Props) {

    const [searchTerm, setSearchTerm] =
        useState('');

    const [priorityFilter, setPriorityFilter] =
        useState<PriorityFilter>('all');

    const columns =
        Object.values(taskStatuses);

    const filteredTasks =
        tasks.filter((task) => {

            const normalizedSearch =
                searchTerm
                    .trim()
                    .toLowerCase();

            const matchesSearch =
                !normalizedSearch ||
                task.title
                    .toLowerCase()
                    .includes(normalizedSearch) ||
                task.description
                    ?.toLowerCase()
                    .includes(normalizedSearch);

            const matchesPriority =
                priorityFilter === 'all' ||
                task.priority === priorityFilter;

            return (
                matchesSearch &&
                matchesPriority
            );
        });

    function handleDragEnd(
        event: DragEndEvent
    ) {

        const { active, over } =
            event;

        if (!over) {
            return;
        }

        const taskId =
            Number(active.id);

        const newStatus =
            over.id as TaskStatusKey;

        onUpdateTaskStatus(
            taskId,
            newStatus
        );
    }

    return (
        <>
            <Toolbar>

                <Input
                    value={searchTerm}
                    onChange={(event) =>
                        setSearchTerm(
                            event.target.value
                        )
                    }
                    placeholder="Board durchsuchen..."
                />

                <Select
                    value={priorityFilter}
                    onChange={(event) =>
                        setPriorityFilter(
                            event.target.value as PriorityFilter
                        )
                    }
                >

                    <option value="all">
                        Alle Prioritäten
                    </option>

                    {Object.values(taskPriorities).map((priority) => (
                        <option
                            key={priority.key}
                            value={priority.key}
                        >
                            {priority.label}
                        </option>
                    ))}

                </Select>

            </Toolbar>

            <DndContext
                onDragEnd={handleDragEnd}
            >

                <BoardWrapper>

                    <Board>

                        {columns.map((column) => {

                            const columnTasks =
                                filteredTasks.filter(
                                    (task) =>
                                        task.status === column.key
                                );

                            return (
                                <TaskColumn
                                    key={column.key}
                                    title={column.label}
                                    status={column.key as TaskStatusKey}
                                    tasks={columnTasks}
                                    onDeleteTask={onDeleteTask}
                                    onEditTask={onEditTask}
                                    onOpenTask={onOpenTask}
                                />
                            );
                        })}

                    </Board>

                </BoardWrapper>

            </DndContext>
        </>
    );
}
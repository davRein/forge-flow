import styled from 'styled-components';
import { useDroppable } from '@dnd-kit/core';

import TaskCard from './TaskCard';

import { Task, TaskStatusKey } from '../../../types/task.types';

const Container = styled.div<{ $isOver: boolean }>`
    background: ${({ theme, $isOver }) =>
            $isOver ? theme.colors.primarySubtle : theme.colors.content};

    border: 1px solid
    ${({ theme, $isOver }) =>
            $isOver ? theme.colors.primary : theme.colors.border};

    border-radius: 8px;

    padding: 14px;
    min-height: 420px;

    transition:
            background 0.15s ease,
            border-color 0.15s ease;
`;

const Header = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;

    margin-bottom: 14px;
    padding-bottom: 10px;

    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const Title = styled.h4`
    margin: 0;
    color: ${({ theme }) => theme.colors.textSecondary};
    font-size: 12px;
    font-weight: 600;
`;

const Count = styled.span`
    min-width: 26px;
    height: 24px;

    display: inline-flex;
    align-items: center;
    justify-content: center;

    border-radius: 5px;

    color: ${({ theme }) => theme.colors.textSecondary};
    background: ${({ theme }) => theme.colors.header};

    font-size: 12px;
    font-weight: 700;
`;

const TaskStack = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
`;

const EmptyColumn = styled.div`
    border: 1px dashed ${({ theme }) => theme.colors.border};
    border-radius: 10px;

    padding: 18px;

    color: ${({ theme }) => theme.colors.textSecondary};
    text-align: center;

    font-size: 13px;
`;

type Props = {
    title: string;
    status: TaskStatusKey;
    tasks: Task[];

    onDeleteTask: (taskId: number) => void;
    onEditTask: (task: Task) => void;
    onOpenTask: (taskId: number) => void;
};

export default function TaskColumn({
                                       title,
                                       status,
                                       tasks,
                                       onDeleteTask,
                                       onEditTask,
                                       onOpenTask
                                   }: Props) {

    const { setNodeRef, isOver } =
        useDroppable({
            id: status
        });

    return (
        <Container
            ref={setNodeRef}
            $isOver={isOver}
        >

            <Header>

                <Title>
                    {title}
                </Title>

                <Count>
                    {tasks.length}
                </Count>

            </Header>

            <TaskStack>

                {tasks.length === 0 && (
                    <EmptyColumn>
                        Keine Tasks
                    </EmptyColumn>
                )}

                {tasks.map((task) => (
                    <TaskCard
                        key={task.id}
                        task={task}
                        onDelete={() =>
                            onDeleteTask(task.id)
                        }
                        onEdit={() =>
                            onEditTask(task)
                        }
                        onOpen={() =>
                            onOpenTask(task.id)
                        }
                    />
                ))}

            </TaskStack>

        </Container>
    );
}

import styled from 'styled-components';

import { Project } from '../../types/project.types';
import { useTasks } from './hooks/useTasks';

import TaskEditor from './components/TaskEditor';
import TaskList from './components/TaskList';
import type { Epic } from '../../types/epic.types';
import type { Sprint } from '../../types/sprint.types';


type TaskState = ReturnType<typeof useTasks>;



const Container = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
`;

const HeaderRow = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
`;

const Button = styled.button`
    border: none;
    border-radius: 8px;
    padding: 8px 12px;
    cursor: pointer;

    color: ${({ theme }) => theme.colors.onPrimary};
    background: ${({ theme }) => theme.colors.primary};

    font-weight: 700;
`;

type Props = {
    project: Project;
    taskState: TaskState;
    epics: Epic[];
    sprints: Sprint[];
};

export default function TasksTab({ taskState, epics, sprints }: Props) {
    return (
        <Container>
            <HeaderRow>
                <h3>Tasks</h3>

                <Button onClick={taskState.startCreateTask}>
                    + Task
                </Button>
            </HeaderRow>

            <TaskEditor taskState={taskState} epics={epics} />

            <TaskList
                tasks={taskState.projectTasks}
                epics={epics}
                sprints={sprints}
                onDeleteTask={taskState.deleteTask}
                onEditTask={taskState.startEditTask}
            />
        </Container>
    );
}

import styled from 'styled-components';

import { Project } from '../../types/project.types';
import { useTasks } from './hooks/useTasks';

import TaskForm from './components/TaskForm';
import TaskList from './components/TaskList';


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

    color: ${({ theme }) => theme.colors.text};
    background: ${({ theme }) => theme.colors.primary};

    font-weight: 700;
`;

type Props = {
    project: Project;
    taskState: TaskState;
};

export default function TasksTab({ taskState }: Props) {
    return (
        <Container>
            <HeaderRow>
                <h3>Tasks</h3>

                <Button onClick={() => taskState.setShowForm(true)}>
                    + Task
                </Button>
            </HeaderRow>

            {taskState.showForm && (
                <TaskForm
                    title={taskState.title}
                    setTitle={taskState.setTitle}
                    status={taskState.status}
                    setStatus={taskState.setStatus}
                    priority={taskState.priority}
                    setPriority={taskState.setPriority}
                    onSave={taskState.saveTask}
                    onCancel={taskState.closeForm}
                    isEditing={taskState.editingTaskId !== null}
                    description={taskState.description}
                    setDescription={taskState.setDescription}
                />
            )}

            <TaskList
                tasks={taskState.projectTasks}
                onDeleteTask={taskState.deleteTask}
                onEditTask={taskState.startEditTask}
            />
        </Container>
    );
}
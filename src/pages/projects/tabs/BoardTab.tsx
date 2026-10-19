import TaskBoard from './tasks/components/TaskBoard';
import { useState } from 'react';
import TaskDrawer from './tasks/components/TaskDrawer';
import TaskEditor from './tasks/components/TaskEditor';
import type { Epic } from '../types/epic.types';
import type { Sprint } from '../types/sprint.types';
import { Field, Select } from '../styles/projectStyles';
import { getTaskSprint } from './sprints/utils/sprintLogic';

import { useTasks } from './tasks/hooks/useTasks';

type TaskState = ReturnType<typeof useTasks>;

type Props = {
    taskState: TaskState;
    epics: Epic[];
    sprints: Sprint[];
};

export default function BoardTab({
                                     taskState,
                                     epics,
                                     sprints
                                 }: Props) {
    const [filter, setFilter] = useState('all');
    const openSprints = sprints.filter((sprint) => sprint.status !== 'completed');
    const boardTasks = taskState.projectTasks.filter((task) => {
        if (filter === 'all') return true;
        const sprint = getTaskSprint(sprints, task.projectId, task.id);
        return filter === 'backlog' ? !sprint && task.status !== 'done' : sprint?.id === Number(filter);
    });

    return (
        <>
            <Field style={{ marginBottom: 16 }}>
                Sprint im Board
                <Select value={filter} onChange={(event) => setFilter(event.target.value)}>
                    <option value="all">Alle Aufgaben</option>
                    <option value="backlog">Backlog</option>
                    {openSprints.map((sprint) => <option key={sprint.id} value={sprint.id}>{sprint.title}{sprint.status === 'active' ? ' (Aktiv)' : ''}</option>)}
                </Select>
            </Field>
            <TaskEditor taskState={taskState} epics={epics} />

            <TaskBoard
                tasks={boardTasks}
                onDeleteTask={taskState.deleteTask}
                onEditTask={taskState.startEditTask}
                onUpdateTaskStatus={taskState.updateTaskStatus}
                onOpenTask={taskState.openTask}
            />

            {taskState.selectedTask && (
                <TaskDrawer
                    task={taskState.selectedTask}
                    onClose={taskState.closeTask}
                    epics={epics}
                    sprints={sprints}
                />
            )}

        </>
    );
}

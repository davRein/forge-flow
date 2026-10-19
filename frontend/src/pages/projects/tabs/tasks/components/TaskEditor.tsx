import type { Epic } from '../../../types/epic.types';
import type { useTasks } from '../hooks/useTasks';
import TaskForm from './TaskForm';

type Props = {
    taskState: ReturnType<typeof useTasks>;
    epics: Epic[];
};

export default function TaskEditor({ taskState, epics }: Props) {
    if (!taskState.showForm) return null;

    return (
        <TaskForm
            title={taskState.title}
            setTitle={taskState.setTitle}
            description={taskState.description}
            setDescription={taskState.setDescription}
            status={taskState.status}
            setStatus={taskState.setStatus}
            priority={taskState.priority}
            setPriority={taskState.setPriority}
            epicId={taskState.epicId}
            setEpicId={taskState.setEpicId}
            epics={epics}
            isEditing={taskState.editingTaskId !== null}
            onSave={taskState.saveTask}
            onCancel={taskState.closeForm}
        />
    );
}

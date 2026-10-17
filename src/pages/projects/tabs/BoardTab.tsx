import TaskBoard from './tasks/components/TaskBoard';
import TaskDrawer from './tasks/components/TaskDrawer';

import { useTasks } from './tasks/hooks/useTasks';

type TaskState = ReturnType<typeof useTasks>;

type Props = {
    taskState: TaskState;
};

export default function BoardTab({
                                     taskState
                                 }: Props) {

    return (
        <>

            <TaskBoard
                tasks={taskState.projectTasks}
                onDeleteTask={taskState.deleteTask}
                onEditTask={taskState.startEditTask}
                onUpdateTaskStatus={taskState.updateTaskStatus}
                onOpenTask={taskState.openTask}
            />

            {taskState.selectedTask && (
                <TaskDrawer
                    task={taskState.selectedTask}
                    onClose={taskState.closeTask}
                />
            )}

        </>
    );
}
import { useRef, useState } from 'react';

import { useWorkspaceField } from '../../../../../hooks/workspaceContext';

import {
    Task,
    TaskPriorityKey,
    TaskStatusKey
} from '../../../types/task.types';

import { Activity } from '../../../types/activity.types';
import type { Epic } from '../../../types/epic.types';

export function useTasks(projectId: number, defaultPriority: TaskPriorityKey = 'medium') {

    const [taskList, setTaskList] = useWorkspaceField('tasks');
    const [activityList, setActivityList] = useWorkspaceField('activities');
    const nextTaskId = useRef(Math.max(0, ...taskList.map((task) => task.id)) + 1);
    const nextActivityId = useRef(Math.max(0, ...activityList.map((activity) => activity.id)) + 1);

    const [showForm, setShowForm] =
        useState(false);

    const [editingTaskId, setEditingTaskId] =
        useState<number | null>(null);

    const [selectedTaskId, setSelectedTaskId] =
        useState<number | null>(null);

    const [title, setTitle] =
        useState('');

    const [description, setDescription] =
        useState('');

    const [status, setStatus] =
        useState<TaskStatusKey>('todo');

    const [priority, setPriority] =
        useState<TaskPriorityKey>(defaultPriority);
    const [epicId, setEpicId] = useState<number | undefined>();

    const projectTasks = taskList.filter(
        (task) => task.projectId === projectId
    );

    const selectedTask =
        taskList.find(
            (task) => task.id === selectedTaskId && task.projectId === projectId
        );

    function resetForm() {

        setEditingTaskId(null);

        setTitle('');
        setDescription('');

        setStatus('todo');
        setPriority(defaultPriority);
        setEpicId(undefined);
    }

    function closeForm() {

        resetForm();

        setShowForm(false);
    }

    function openTask(taskId: number) {
        setSelectedTaskId(taskId);
    }

    function startCreateTask() {
        resetForm();
        setShowForm(true);
    }

    function closeTask() {
        setSelectedTaskId(null);
    }

    function addActivity(
        type: Activity['type'],
        message: string
    ) {

        const nextId = nextActivityId.current++;

        const now =
            new Date()
                .toISOString()
                .split('T')[0];

        const newActivity: Activity = {
            id: nextId,
            projectId,
            type,
            message,
            createdAt: now
        };

        setActivityList((currentActivities) => [
            newActivity,
            ...currentActivities
        ]);
    }

    function createTask() {

        if (!title.trim()) {
            return;
        }

        const nextId = nextTaskId.current++;

        const now =
            new Date()
                .toISOString()
                .split('T')[0];

        const newTask: Task = {
            id: nextId,
            code: `FF-${nextId}`,

            projectId,
            epicId,

            title: title.trim(),

            description:
                description.trim(),

            status,
            priority,

            createdAt: now,
            updatedAt: now
        };

        setTaskList((currentTasks) => [
            ...currentTasks,
            newTask
        ]);

        addActivity(
            'task_created',
            `${newTask.code} wurde erstellt`
        );

        closeForm();
    }

    function deleteTask(taskId: number) {
        if (selectedTaskId === taskId) closeTask();

        const taskToDelete =
            taskList.find(
                (task) => task.id === taskId
            );

        setTaskList((currentTasks) =>
            currentTasks.filter(
                (task) => task.id !== taskId
            )
        );

        if (taskToDelete) {
            addActivity(
                'task_deleted',
                `${taskToDelete.code} wurde gelöscht`
            );
        }
    }

    function startEditTask(task: Task) {

        setEditingTaskId(task.id);

        setTitle(task.title);

        setDescription(
            task.description ?? ''
        );

        setStatus(task.status);
        setPriority(task.priority);
        setEpicId(task.epicId);

        setShowForm(true);
    }

    function saveTask() {

        if (!title.trim()) {
            return;
        }

        if (editingTaskId) {

            const now =
                new Date()
                    .toISOString()
                    .split('T')[0];

            setTaskList((currentTasks) =>
                currentTasks.map((task) =>
                    task.id === editingTaskId
                        ? {
                            ...task,

                            title: title.trim(),

                            description:
                                description.trim(),

                            status,
                            priority,
                            epicId,

                            updatedAt: now
                        }
                        : task
                )
            );

            const updatedTask =
                taskList.find(
                    (task) =>
                        task.id === editingTaskId
                );

            if (updatedTask) {
                addActivity(
                    'task_updated',
                    `${updatedTask.code} wurde aktualisiert`
                );
            }

            setEditingTaskId(null);

            closeForm();

            return;
        }

        createTask();
    }

    function updateTaskStatus(
        taskId: number,
        newStatus: TaskStatusKey
    ) {
        const movedTask = projectTasks.find((task) => task.id === taskId);
        if (!movedTask || movedTask.status === newStatus) return;

        setTaskList((currentTasks) =>
            currentTasks.map((task) =>
                task.id === taskId
                    ? {
                        ...task,
                        status: newStatus,
                        updatedAt: new Date().toISOString().split('T')[0]
                    }
                    : task
            )
        );

        if (movedTask) {
            addActivity(
                'task_moved',
                `${movedTask.code} wurde verschoben`
            );
        }
    }

    function removeProjectTasks(deletedProjectId: number) {
        setTaskList((current) => current.filter((task) => task.projectId !== deletedProjectId));
        setActivityList((current) => current.filter((activity) => activity.projectId !== deletedProjectId));
        if (projectId === deletedProjectId) {
            closeForm();
            closeTask();
        }
    }

    function assignTasksToEpic(epic: Epic, taskIds: number[]) {
        if (epic.projectId !== projectId) return;
        const selectedIds = new Set(taskIds);
        const now = new Date().toISOString().split('T')[0];
        setTaskList((current) => current.map((task) => {
            if (task.projectId !== projectId) return task;
            const nextEpicId = selectedIds.has(task.id) ? epic.id : task.epicId === epic.id ? undefined : task.epicId;
            return nextEpicId === task.epicId ? task : { ...task, epicId: nextEpicId, updatedAt: now };
        }));
        if (editingTaskId !== null) {
            const editedTask = projectTasks.find((task) => task.id === editingTaskId);
            if (editedTask) {
                setEpicId(selectedIds.has(editedTask.id) ? epic.id : editedTask.epicId === epic.id ? undefined : editedTask.epicId);
            }
        }
    }

    function clearEpicAssignments(deletedEpicId: number) {
        const now = new Date().toISOString().split('T')[0];
        setTaskList((current) => current.map((task) => task.projectId === projectId && task.epicId === deletedEpicId
            ? { ...task, epicId: undefined, updatedAt: now } : task));
        if (epicId === deletedEpicId) setEpicId(undefined);
    }

    return {

        projectTasks,

        activityList: activityList.filter((activity) => activity.projectId === projectId),
        removeProjectTasks,
        assignTasksToEpic,
        clearEpicAssignments,
        addActivity,

        selectedTask,

        openTask,
        closeTask,

        showForm,
        setShowForm,

        closeForm,
        startCreateTask,

        editingTaskId,

        title,
        setTitle,

        description,
        setDescription,

        status,
        setStatus,

        priority,
        setPriority,
        epicId,
        setEpicId,

        createTask,
        saveTask,

        deleteTask,

        startEditTask,

        updateTaskStatus
    };
}

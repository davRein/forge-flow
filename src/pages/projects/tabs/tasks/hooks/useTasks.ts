import { useState } from 'react';

import { tasks as initialTasks } from '../../../../../data/tasks';

import {
    Task,
    TaskPriorityKey,
    TaskStatusKey
} from '../../../types/task.types';

import { Activity } from '../../../types/activity.types';

export function useTasks(projectId: number) {

    const [taskList, setTaskList] = useState<Task[]>(
        initialTasks as Task[]
    );

    const [activityList, setActivityList] =
        useState<Activity[]>([]);

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
        useState<TaskPriorityKey>('medium');

    const projectTasks = taskList.filter(
        (task) => task.projectId === projectId
    );

    const selectedTask =
        taskList.find(
            (task) => task.id === selectedTaskId
        );

    function resetForm() {

        setEditingTaskId(null);

        setTitle('');
        setDescription('');

        setStatus('todo');
        setPriority('medium');
    }

    function closeForm() {

        resetForm();

        setShowForm(false);
    }

    function openTask(taskId: number) {
        setSelectedTaskId(taskId);
    }

    function closeTask() {
        setSelectedTaskId(null);
    }

    function addActivity(
        type: Activity['type'],
        message: string
    ) {

        const nextId =
            activityList.length > 0
                ? Math.max(
                ...activityList.map(
                    (activity) => activity.id
                )
            ) + 1
                : 1;

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

        const nextId =
            taskList.length > 0
                ? Math.max(
                ...taskList.map(
                    (task) => task.id
                )
            ) + 1
                : 1;

        const now =
            new Date()
                .toISOString()
                .split('T')[0];

        const newTask: Task = {
            id: nextId,
            code: `FF-${nextId}`,

            projectId,

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

        setTaskList((currentTasks) =>
            currentTasks.map((task) =>
                task.id === taskId
                    ? {
                        ...task,
                        status: newStatus
                    }
                    : task
            )
        );

        const movedTask =
            taskList.find(
                (task) => task.id === taskId
            );

        if (movedTask) {
            addActivity(
                'task_moved',
                `${movedTask.code} wurde verschoben`
            );
        }
    }

    return {

        projectTasks,

        activityList,

        selectedTask,

        openTask,
        closeTask,

        showForm,
        setShowForm,

        closeForm,

        editingTaskId,

        title,
        setTitle,

        description,
        setDescription,

        status,
        setStatus,

        priority,
        setPriority,

        createTask,
        saveTask,

        deleteTask,

        startEditTask,

        updateTaskStatus
    };
}
import { taskStatuses } from '../../../data/taskStatuses';
import { taskPriorities } from '../../../data/taskPriorities';

export type TaskStatusKey = keyof typeof taskStatuses;
export type TaskPriorityKey = keyof typeof taskPriorities;

export type Task = {
    id: number;
    code: string;
    projectId: number;
    epicId?: number;
    title: string;
    description?: string;
    status: TaskStatusKey;
    priority: TaskPriorityKey;
    createdAt: string;
    updatedAt: string;
};

import type { Task } from './task.types';

export type SprintStatus = 'planned' | 'active' | 'completed';
export type SprintTaskSnapshot = Pick<Task, 'id' | 'code' | 'title' | 'status'>;

export type Sprint = {
    id: number;
    projectId: number;
    title: string;
    goal: string;
    startDate: string;
    endDate: string;
    status: SprintStatus;
    taskIds: number[];
    createdAt: string;
    updatedAt: string;
    startedAt?: string;
    completion?: { completedAt: string; tasks: SprintTaskSnapshot[] };
};

export type SprintDraft = Pick<Sprint, 'title' | 'goal' | 'startDate' | 'endDate' | 'taskIds'>;

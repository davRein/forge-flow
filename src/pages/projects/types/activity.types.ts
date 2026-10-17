export type ActivityType =
    | 'task_created'
    | 'task_updated'
    | 'task_moved'
    | 'task_deleted';

export type Activity = {
    id: number;
    projectId: number;
    type: ActivityType;
    message: string;
    createdAt: string;
};
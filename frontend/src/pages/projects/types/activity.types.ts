export type ActivityType =
    | 'task_created'
    | 'task_updated'
    | 'task_moved'
    | 'task_deleted'
    | 'epic_created'
    | 'epic_updated'
    | 'epic_deleted'
    | 'sprint_created'
    | 'sprint_updated'
    | 'sprint_started'
    | 'sprint_completed'
    | 'sprint_deleted'
    | 'file_added'
    | 'file_renamed'
    | 'file_removed';

export type Activity = {
    id: number;
    projectId: number;
    type: ActivityType;
    message: string;
    createdAt: string;
};

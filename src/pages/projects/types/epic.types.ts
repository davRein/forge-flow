export type Epic = {
    id: number;
    projectId: number;
    title: string;
    description: string;
    createdAt: string;
    updatedAt: string;
};

export type EpicDraft = {
    title: string;
    description: string;
    taskIds: number[];
};

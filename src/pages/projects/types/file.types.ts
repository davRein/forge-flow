export type ProjectFile = {
    id: number;
    projectId: number;
    name: string;
    content: File;
    addedAt: string;
    updatedAt: string;
};

export type FileRejection = { name: string; reason: string };
export type FileCategory = 'image' | 'document' | 'archive' | 'code' | 'other';

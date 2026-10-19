import type { Customer, Project } from '../../pages/projects/types/project.types';
import type { Task } from '../../pages/projects/types/task.types';
import type { Activity } from '../../pages/projects/types/activity.types';
import type { Epic } from '../../pages/projects/types/epic.types';
import type { Sprint } from '../../pages/projects/types/sprint.types';
import type { ProjectFile } from '../../pages/projects/types/file.types';
import type { WikiData } from '../../pages/wiki/types/wiki.types';

export type Workspace = { projects: Project[]; customers: Customer[]; tasks: Task[]; activities: Activity[]; epics: Epic[]; sprints: Sprint[]; files: ProjectFile[]; wiki: WikiData };
export type RemoteFile = Omit<ProjectFile, 'content'> & { size: number; mediaType: string; lastModified: number };
export type WorkspaceManifest = Omit<Workspace, 'files'> & { files: RemoteFile[] };
export type WorkspaceRecord = { version: 1; revision: string; data: WorkspaceManifest };
export type WorkspaceRepository = {
    persistence: 'session' | 'account';
    load(signal: AbortSignal): Promise<{ data: Workspace; revision: string }>;
    save(data: Workspace, revision: string, signal: AbortSignal): Promise<string>;
};
